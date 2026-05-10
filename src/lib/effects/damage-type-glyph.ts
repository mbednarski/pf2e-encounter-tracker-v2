export type DamageTypeColor = 'red' | 'blue' | 'amber' | 'green' | 'ink';

export interface DamageTypeGlyphInfo {
  glyph: string;
  color: DamageTypeColor;
  aria: string;
}

const TABLE: Record<string, DamageTypeGlyphInfo> = {
  fire: { glyph: '🔥', color: 'red', aria: 'Fire' },
  cold: { glyph: '❄', color: 'blue', aria: 'Cold' },
  acid: { glyph: '🧪', color: 'green', aria: 'Acid' },
  electricity: { glyph: '⚡', color: 'amber', aria: 'Electricity' },
  sonic: { glyph: '♪', color: 'blue', aria: 'Sonic' },
  bleed: { glyph: '🩸', color: 'red', aria: 'Bleed' },
  poison: { glyph: '☠', color: 'green', aria: 'Poison' },
  mental: { glyph: '🧠', color: 'amber', aria: 'Mental' },
  bludgeoning: { glyph: '🔨', color: 'ink', aria: 'Bludgeoning' },
  piercing: { glyph: '➹', color: 'ink', aria: 'Piercing' },
  slashing: { glyph: '⚔', color: 'ink', aria: 'Slashing' }
};

export function damageTypeGlyph(type: string): DamageTypeGlyphInfo {
  return TABLE[type.toLowerCase()] ?? { glyph: '◯', color: 'ink', aria: type };
}

const PERSISTENT_PREFIX = 'persistent-';

export function persistentEffectIdToDamageType(effectId: string): string | null {
  if (!effectId.startsWith(PERSISTENT_PREFIX)) return null;
  const tail = effectId.slice(PERSISTENT_PREFIX.length);
  return tail.length > 0 ? tail : null;
}
