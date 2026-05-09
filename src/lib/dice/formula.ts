export interface ParsedDiceFormula {
  dice: number;
  dieSize: number;
  bonus: number;
}

const FORMULA_RE = /^(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?$/i;

export function parseDiceFormula(input: string): ParsedDiceFormula | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;
  const match = FORMULA_RE.exec(trimmed.replace(/\s+/g, ''));
  if (!match) return null;
  const dice = Number(match[1]);
  const dieSize = Number(match[2]);
  if (dice < 1 || dieSize < 2) return null;
  const sign = match[3] === '-' ? -1 : 1;
  const bonus = match[4] !== undefined ? sign * Number(match[4]) : 0;
  return { dice, dieSize, bonus };
}

export function rollDiceFormula(input: string, rng: () => number = Math.random): number | null {
  const parsed = parseDiceFormula(input);
  if (!parsed) return null;
  let total = parsed.bonus;
  for (let i = 0; i < parsed.dice; i++) {
    total += Math.floor(rng() * parsed.dieSize) + 1;
  }
  return Math.max(total, 0);
}
