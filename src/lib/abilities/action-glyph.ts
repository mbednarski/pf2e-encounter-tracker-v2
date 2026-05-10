import type { ActionCost } from '../../domain';

export interface ActionGlyphInfo {
  glyph: string;
  aria: string;
}

const EMPTY: ActionGlyphInfo = { glyph: '', aria: '' };

export function actionGlyph(cost: ActionCost | undefined): ActionGlyphInfo {
  if (cost === undefined) return EMPTY;
  if (cost === 'free') return { glyph: '◇', aria: 'Free action' };
  if (cost === 'reaction') return { glyph: '↺', aria: 'Reaction' };
  if (cost === 1) return { glyph: '◆', aria: '1 action' };
  if (cost === 2) return { glyph: '◆◆', aria: '2 actions' };
  return { glyph: '◆◆◆', aria: '3 actions' };
}
