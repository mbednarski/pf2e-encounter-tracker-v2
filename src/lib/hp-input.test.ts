import { describe, expect, it } from 'vitest';
import { parseHpExpression, resolveHpEdit } from './hp-input';

describe('parseHpExpression', () => {
  describe('cancel', () => {
    it('treats empty string as cancel', () => {
      expect(parseHpExpression('')).toEqual({ kind: 'cancel' });
    });

    it('treats whitespace-only input as cancel', () => {
      expect(parseHpExpression('   ')).toEqual({ kind: 'cancel' });
      expect(parseHpExpression('\t')).toEqual({ kind: 'cancel' });
    });
  });

  describe('set', () => {
    it('parses bare positive integer as set', () => {
      expect(parseHpExpression('42')).toEqual({ kind: 'set', n: 42 });
    });

    it('parses zero as set 0', () => {
      expect(parseHpExpression('0')).toEqual({ kind: 'set', n: 0 });
    });

    it('tolerates surrounding whitespace', () => {
      expect(parseHpExpression('  42  ')).toEqual({ kind: 'set', n: 42 });
    });
  });

  describe('add', () => {
    it('parses +N as add', () => {
      expect(parseHpExpression('+5')).toEqual({ kind: 'add', n: 5 });
    });

    it('parses +0 as add 0', () => {
      expect(parseHpExpression('+0')).toEqual({ kind: 'add', n: 0 });
    });

    it('tolerates surrounding whitespace on add', () => {
      expect(parseHpExpression('  +3  ')).toEqual({ kind: 'add', n: 3 });
    });
  });

  describe('sub', () => {
    it('parses -N as sub', () => {
      expect(parseHpExpression('-7')).toEqual({ kind: 'sub', n: 7 });
    });

    it('parses -0 as sub 0', () => {
      expect(parseHpExpression('-0')).toEqual({ kind: 'sub', n: 0 });
    });

    it('tolerates surrounding whitespace on sub', () => {
      expect(parseHpExpression('  -4  ')).toEqual({ kind: 'sub', n: 4 });
    });
  });

  describe('invalid', () => {
    it('rejects decimals', () => {
      expect(parseHpExpression('2.5')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('-2.5')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('+2.5')).toEqual({ kind: 'invalid' });
    });

    it('rejects arithmetic expressions', () => {
      expect(parseHpExpression('5+3')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('5-3')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('-5+3')).toEqual({ kind: 'invalid' });
    });

    it('rejects double signs', () => {
      expect(parseHpExpression('--5')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('++5')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('+-5')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('-+5')).toEqual({ kind: 'invalid' });
    });

    it('rejects bare signs', () => {
      expect(parseHpExpression('-')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('+')).toEqual({ kind: 'invalid' });
    });

    it('rejects letters and mixed garbage', () => {
      expect(parseHpExpression('abc')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('5a')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('a5')).toEqual({ kind: 'invalid' });
      expect(parseHpExpression('5 5')).toEqual({ kind: 'invalid' });
    });
  });
});

describe('resolveHpEdit', () => {
  const baseCurrent = { hp: 17, maxHp: 30, tempHp: 0 };

  describe('HP field', () => {
    it('returns null for cancel', () => {
      expect(resolveHpEdit('hp', { kind: 'cancel' }, baseCurrent)).toBeNull();
    });

    it('returns null for invalid', () => {
      expect(resolveHpEdit('hp', { kind: 'invalid' }, baseCurrent)).toBeNull();
    });

    it('maps set N (under max) to SET_HP literal', () => {
      expect(resolveHpEdit('hp', { kind: 'set', n: 25 }, baseCurrent)).toEqual({
        type: 'SET_HP',
        amount: 25
      });
    });

    it('clamps set N above max to maxHp', () => {
      expect(resolveHpEdit('hp', { kind: 'set', n: 999 }, baseCurrent)).toEqual({
        type: 'SET_HP',
        amount: 30
      });
    });

    it('clamps set N exactly at max', () => {
      expect(resolveHpEdit('hp', { kind: 'set', n: 30 }, baseCurrent)).toEqual({
        type: 'SET_HP',
        amount: 30
      });
    });

    it('passes set 0 through (death decisions live in the domain)', () => {
      expect(resolveHpEdit('hp', { kind: 'set', n: 0 }, baseCurrent)).toEqual({
        type: 'SET_HP',
        amount: 0
      });
    });

    it('maps add N to APPLY_HEALING (reducer clamps at max)', () => {
      expect(resolveHpEdit('hp', { kind: 'add', n: 5 }, baseCurrent)).toEqual({
        type: 'APPLY_HEALING',
        amount: 5
      });
    });

    it('maps sub N to APPLY_DAMAGE (reducer absorbs tempHP first)', () => {
      expect(resolveHpEdit('hp', { kind: 'sub', n: 7 }, baseCurrent)).toEqual({
        type: 'APPLY_DAMAGE',
        amount: 7
      });
    });

    it('never produces a SET_TEMP_HP intent', () => {
      const kinds = ['set', 'add', 'sub'] as const;
      for (const kind of kinds) {
        const intent = resolveHpEdit('hp', { kind, n: 3 }, baseCurrent);
        expect(intent?.type).not.toBe('SET_TEMP_HP');
      }
    });
  });

  describe('TempHP field', () => {
    it('returns null for cancel', () => {
      expect(resolveHpEdit('tempHp', { kind: 'cancel' }, baseCurrent)).toBeNull();
    });

    it('returns null for invalid', () => {
      expect(resolveHpEdit('tempHp', { kind: 'invalid' }, baseCurrent)).toBeNull();
    });

    it('maps set N to SET_TEMP_HP literal', () => {
      expect(resolveHpEdit('tempHp', { kind: 'set', n: 5 }, baseCurrent)).toEqual({
        type: 'SET_TEMP_HP',
        amount: 5
      });
    });

    it('maps set 0 to SET_TEMP_HP 0 (clear tempHP)', () => {
      const current = { hp: 17, maxHp: 30, tempHp: 8 };
      expect(resolveHpEdit('tempHp', { kind: 'set', n: 0 }, current)).toEqual({
        type: 'SET_TEMP_HP',
        amount: 0
      });
    });

    it('maps add N to literal current + N (no PF2e max-stack rule)', () => {
      const current = { hp: 17, maxHp: 30, tempHp: 3 };
      expect(resolveHpEdit('tempHp', { kind: 'add', n: 5 }, current)).toEqual({
        type: 'SET_TEMP_HP',
        amount: 8
      });
    });

    it('maps add N from zero tempHP to N', () => {
      expect(resolveHpEdit('tempHp', { kind: 'add', n: 5 }, baseCurrent)).toEqual({
        type: 'SET_TEMP_HP',
        amount: 5
      });
    });

    it('maps sub N to current - N', () => {
      const current = { hp: 17, maxHp: 30, tempHp: 8 };
      expect(resolveHpEdit('tempHp', { kind: 'sub', n: 5 }, current)).toEqual({
        type: 'SET_TEMP_HP',
        amount: 3
      });
    });

    it('clamps sub N at 0 when N exceeds current tempHP', () => {
      const current = { hp: 17, maxHp: 30, tempHp: 3 };
      expect(resolveHpEdit('tempHp', { kind: 'sub', n: 5 }, current)).toEqual({
        type: 'SET_TEMP_HP',
        amount: 0
      });
    });

    it('only ever produces SET_TEMP_HP (never touches HP)', () => {
      const kinds = ['set', 'add', 'sub'] as const;
      for (const kind of kinds) {
        const intent = resolveHpEdit('tempHp', { kind, n: 3 }, baseCurrent);
        expect(intent?.type).toBe('SET_TEMP_HP');
      }
    });
  });
});
