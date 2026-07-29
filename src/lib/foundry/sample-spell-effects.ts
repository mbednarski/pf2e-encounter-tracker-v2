/// <reference types="vite/client" />
/**
 * Starter spell-effect pack: a curated set of Foundry pf2e spell-effect
 * documents (bard compositions plus common buffs) bundled as fixtures and
 * mapped through the regular importer, so "Add starter effects" behaves
 * exactly like importing the same files by hand.
 */
import type { EffectDefinition } from '../../domain';
import { mapFoundryEffectToDefinition } from './effect-mapper';
import rallyingAnthem from './fixtures/spell-effect-rallying-anthem.json?raw';
import courageousAnthem from './fixtures/spell-effect-courageous-anthem.json?raw';
import songOfStrength from './fixtures/spell-effect-song-of-strength.json?raw';
import fortissimoComposition from './fixtures/spell-effect-fortissimo-composition.json?raw';
import heroism from './fixtures/spell-effect-heroism.json?raw';
import bless from './fixtures/spell-effect-bless.json?raw';
import haste from './fixtures/spell-effect-haste.json?raw';
import mysticArmor from './fixtures/spell-effect-mystic-armor.json?raw';

const RAW_DOCS = [
  rallyingAnthem,
  courageousAnthem,
  songOfStrength,
  fortissimoComposition,
  heroism,
  bless,
  haste,
  mysticArmor
];

export function sampleSpellEffects(): EffectDefinition[] {
  const effects: EffectDefinition[] = [];
  for (const raw of RAW_DOCS) {
    const mapped = mapFoundryEffectToDefinition(JSON.parse(raw));
    if (mapped.ok) effects.push(mapped.value);
  }
  return effects;
}
