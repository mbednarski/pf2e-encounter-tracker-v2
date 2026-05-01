export type ParsedHpEdit =
  | { kind: 'cancel' }
  | { kind: 'invalid' }
  | { kind: 'set'; n: number }
  | { kind: 'add'; n: number }
  | { kind: 'sub'; n: number };

export type CommittableEdit = Extract<ParsedHpEdit, { kind: 'set' | 'add' | 'sub' }>;

export type HpEditField = 'hp' | 'tempHp';

export type HpEditIntent =
  | { type: 'SET_HP'; amount: number }
  | { type: 'APPLY_HEALING'; amount: number }
  | { type: 'APPLY_DAMAGE'; amount: number }
  | { type: 'SET_TEMP_HP'; amount: number };

export interface HpEditCurrent {
  hp: number;
  maxHp: number;
  tempHp: number;
}

const SET_RE = /^(\d+)$/;
const ADD_RE = /^\+(\d+)$/;
const SUB_RE = /^-(\d+)$/;

export function parseHpExpression(raw: string): ParsedHpEdit {
  const trimmed = raw.trim();
  if (trimmed === '') return { kind: 'cancel' };

  const setMatch = SET_RE.exec(trimmed);
  if (setMatch) return { kind: 'set', n: Number(setMatch[1]) };

  const addMatch = ADD_RE.exec(trimmed);
  if (addMatch) return { kind: 'add', n: Number(addMatch[1]) };

  const subMatch = SUB_RE.exec(trimmed);
  if (subMatch) return { kind: 'sub', n: Number(subMatch[1]) };

  return { kind: 'invalid' };
}

export function resolveHpEdit(
  field: HpEditField,
  parsed: ParsedHpEdit,
  current: HpEditCurrent
): HpEditIntent | null {
  if (parsed.kind === 'cancel' || parsed.kind === 'invalid') return null;

  if (field === 'hp') {
    switch (parsed.kind) {
      case 'set':
        return { type: 'SET_HP', amount: Math.min(parsed.n, current.maxHp) };
      case 'add':
        return { type: 'APPLY_HEALING', amount: parsed.n };
      case 'sub':
        return { type: 'APPLY_DAMAGE', amount: parsed.n };
    }
  }

  switch (parsed.kind) {
    case 'set':
      return { type: 'SET_TEMP_HP', amount: parsed.n };
    case 'add':
      return { type: 'SET_TEMP_HP', amount: current.tempHp + parsed.n };
    case 'sub':
      return { type: 'SET_TEMP_HP', amount: Math.max(current.tempHp - parsed.n, 0) };
  }
}
