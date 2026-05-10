import { describe, expect, test } from 'vitest';
import { actionGlyph } from './action-glyph';

describe('actionGlyph', () => {
  test('1 action → ◆', () => {
    expect(actionGlyph(1)).toEqual({ glyph: '◆', aria: '1 action' });
  });

  test('2 actions → ◆◆', () => {
    expect(actionGlyph(2)).toEqual({ glyph: '◆◆', aria: '2 actions' });
  });

  test('3 actions → ◆◆◆', () => {
    expect(actionGlyph(3)).toEqual({ glyph: '◆◆◆', aria: '3 actions' });
  });

  test('reaction → ↺', () => {
    expect(actionGlyph('reaction')).toEqual({ glyph: '↺', aria: 'Reaction' });
  });

  test('free → ◇', () => {
    expect(actionGlyph('free')).toEqual({ glyph: '◇', aria: 'Free action' });
  });

  test('undefined → empty glyph and label', () => {
    expect(actionGlyph(undefined)).toEqual({ glyph: '', aria: '' });
  });
});
