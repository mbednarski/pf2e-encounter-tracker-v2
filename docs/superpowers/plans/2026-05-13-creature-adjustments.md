# Creature Adjustments (Weak/Elite) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bake-at-creation weak/elite implementation with a snapshot-and-derive-on-read model, add structured optional fields so ability/spell DCs and damage scale with adjustments, and expose a runtime toggle command.

**Architecture:** `CombatantState` stores an immutable `baseSnapshot` plus a `templateAdjustment`. All adjusted values flow through a new pure module `src/domain/creatures/adjusted-view.ts`. `computeCombatantStats` calls `getAdjustedView(combatant)` and feeds the result to the existing `deriveStats` effect-modifier engine. A new `SET_TEMPLATE_ADJUSTMENT` command toggles adjustment mid-encounter, clamping `currentHp` to the recomputed max. Foundry mapper and YAML schema (v2) gain optional structured fields for ability/spell DCs and damage.

**Tech Stack:** TypeScript strict mode (domain has its own `tsconfig.domain.json` and `--noEmit` check), Svelte 5, Vitest, SvelteKit static-export. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-13-creature-adjustments-design.md`

**Working agreement (from `CLAUDE.md`):** All work happens on this branch (`feat/creature-adjustments-redesign`). Pre-PR gate: `npm run check && npm run test:run && npm run audit && npm run build`. Each task ends with a commit; the final task pushes the branch and opens a PR.

---

## File Structure

### Created

- `src/domain/creatures/adjusted-view.ts` — pure derivation helpers; entry point `getAdjustedView`.
- `src/domain/creatures/adjusted-view.test.ts` — colocated unit tests.
- `src/lib/yaml/creature-validator-v2.test.ts` — schema v2 acceptance tests (or extend existing — see Task 9).

### Modified

- `src/domain/types.ts` — extend `Attack`, `Ability`, `SpellListEntry`; add `TemplateAdjustment`, `CreatureSnapshot`; replace `CombatantState.baseStats` with `baseSnapshot + templateAdjustment`; add `SET_TEMPLATE_ADJUSTMENT` command + `template-adjustment-changed` event; remove `CombatantState.level` (now derived).
- `src/domain/creatures/templates.ts` — thin shim that delegates to the new module; keep public API for back-compat tests.
- `src/domain/creatures/templates.test.ts` — update import/expectations or replace with one delegation test.
- `src/domain/creatures/clone.ts` — write `baseSnapshot + templateAdjustment` instead of `baseStats`.
- `src/domain/creatures/clone.test.ts` — replace `baseStats` expectations with `baseSnapshot` + adjusted-view assertions.
- `src/domain/party/factory.ts` — same migration: produce `baseSnapshot + 'normal'`.
- `src/domain/party/factory.test.ts` — same migration.
- `src/domain/reducer.ts` — read max-HP from `getAdjustedView`; add `SET_TEMPLATE_ADJUSTMENT` handler.
- `src/domain/reducer.test.ts` — add coverage for the new command.
- `src/domain/encounter-xp.ts` / `.test.ts` — read `effectiveLevel` from snapshot + adjustment.
- `src/domain/test-support.ts` — fixture builder produces `baseSnapshot`.
- `src/domain/effects/derivation.test.ts` / `library.test.ts` — these tests construct `CreatureBaseStats` directly to test `deriveStats`; they keep working (the **type** survives even though the **field** on `CombatantState` is removed).
- `src/domain/index.ts` — export new helpers and types.
- `src/lib/encounter-app.ts` — `computeCombatantStats` calls `getAdjustedView(combatant)`; add `dispatchSetTemplateAdjustment` and `setTemplateAdjustmentCommand` builder.
- `src/lib/encounter-app.test.ts` — update fixtures to use `baseSnapshot`.
- `src/lib/combat-log/format.test.ts` — update fixture (single `baseStats` reference).
- `src/components/CombatantCard.svelte` / `.test.ts` — read from `getAdjustedView(combatant)` for HP max, defenses; tests update fixtures.
- `src/components/CombatantDetailsPanel.svelte` / `.test.ts` — read adjusted view; render adjustment toggle; render adjusted DCs/damage in ability and spell rows.
- `src/components/details/AttackRow.svelte` — accept the adjusted attack (consumer passes it in).
- `src/components/details/AbilityCard.svelte` — accept adjusted ability and render structured `save.dc` / `damage` when present.
- `src/components/details/SpellcastingBlockView.svelte` — pass adjusted entries through.
- `src/routes/+page.svelte` — dispatch `SET_TEMPLATE_ADJUSTMENT`; read max-HP from adjusted view; update radial/effect modal labels.
- `src/lib/yaml/creature-validator.ts` / `.test.ts` — accept `schemaVersion: 2`; permit new optional fields.
- `src/lib/foundry/types.ts` — extend `FoundryActionSystem` and `FoundrySpellSystem` with damage/save shapes.
- `src/lib/foundry/mapper.ts` / `.test.ts` — populate `Ability.save`, `Ability.damage`, `Ability.isLimitedUse`, `SpellListEntry.save`, `SpellListEntry.damage`; detect `primaryDamageIndex`.
- `src/lib/foundry/fixtures/` — add or extend a fixture with action-save-damage and spell damage.
- `src/lib/template-label.ts` — re-export the wider `TemplateAdjustment` union; still produces 'Normal'/'Elite'/'Weak'.

### Deleted

None.

---

## Phase Overview

| Phase | Tasks | Outcome |
|---|---|---|
| 1 | 1–3 | Types, pure derivation module, back-compat shim. No consumer changes yet; all suites green. |
| 2 | 4–7 | Migrate `CombatantState` to snapshot. Every consumer site moves to `getAdjustedView`. |
| 3 | 8 | `SET_TEMPLATE_ADJUSTMENT` command + reducer + event. |
| 4 | 9–11 | UI: details panel reads adjusted view + renders structured DCs/damage + adjustment toggle. |
| 5 | 12–13 | YAML schema v2 acceptance + Foundry mapper enhancements. |
| 6 | 14 | Pre-PR gate + open PR. |

Each task ends with a commit. Run `npm run check && npm run test:run` after every code-changing task; the PR gate runs `audit` and `build` too.

---

## Task 1: Add type definitions (TemplateAdjustment, CreatureSnapshot, structured optional fields)

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/index.ts`

This task is type-only. It adds new types and new optional fields. It does **not** remove `baseStats` yet (that happens in Task 5). The compiler must remain green.

- [ ] **Step 1: Add `TemplateAdjustment` and `CreatureSnapshot` types in `src/domain/types.ts`.**

Insert directly above `export interface CombatantState`:

```ts
export type TemplateAdjustment = 'normal' | 'elite' | 'weak';

export interface CreatureSnapshot {
  level: number;
  ac: number;
  fortitude: number;
  reflex: number;
  will: number;
  perception: number;
  hp: number;
  speed: number;
  skills: Record<string, number>;
}

export interface AbilitySave {
  defense: 'fortitude' | 'reflex' | 'will';
  dc: number;
  basic?: boolean;
}

export interface SpellEntrySave {
  defense: 'fortitude' | 'reflex' | 'will';
  basic?: boolean;
}
```

- [ ] **Step 2: Extend `Attack` with `primaryDamageIndex?: number`.**

In `src/domain/types.ts`, update `Attack`:

```ts
export interface Attack {
  name: string;
  type: AttackType;
  modifier: number;
  traits: string[];
  damage: DamageComponent[];
  effects?: string[];
  primaryDamageIndex?: number;
}
```

- [ ] **Step 3: Extend `Ability` with `save?`, `damage?`, `isLimitedUse?`.**

```ts
export interface Ability {
  name: string;
  actions?: ActionCost;
  traits?: string[];
  trigger?: string;
  frequency?: string;
  requirements?: string;
  description: string;
  save?: AbilitySave;
  damage?: DamageComponent[];
  isLimitedUse?: boolean;
}
```

- [ ] **Step 4: Extend `SpellListEntry` with `save?` and `damage?`.**

```ts
export interface SpellListEntry {
  spellSlug: string;
  name: string;
  level: number;
  isCantrip?: boolean;
  frequency?: SpellFrequency;
  count?: number;
  save?: SpellEntrySave;
  damage?: DamageComponent[];
}
```

- [ ] **Step 5: Add `SET_TEMPLATE_ADJUSTMENT` to `Command` and `CommandType`.**

In the `Command` union, add:

```ts
  | BaseCommand<'SET_TEMPLATE_ADJUSTMENT', {
      combatantId: CombatantId;
      adjustment: TemplateAdjustment;
    }>
```

In the `CommandType` union string list, add `| 'SET_TEMPLATE_ADJUSTMENT'`.

- [ ] **Step 6: Add `template-adjustment-changed` to `DomainEvent`.**

```ts
  | {
      type: 'template-adjustment-changed';
      combatantId: CombatantId;
      from: TemplateAdjustment;
      to: TemplateAdjustment;
      hpMaxFrom: number;
      hpMaxTo: number;
      currentHpFrom: number;
      currentHpTo: number;
    }
```

- [ ] **Step 7: Update `CombatantState.templateAdjustment` to use `TemplateAdjustment`.**

Change the existing line `templateAdjustment?: 'elite' | 'weak';` to:

```ts
  templateAdjustment?: TemplateAdjustment;
```

(Still optional for now — Task 5 makes it required.)

- [ ] **Step 8: Re-export new types from `src/domain/index.ts`.**

Add to the type re-export list (alphabetical placement):

```ts
  AbilitySave,
  CreatureSnapshot,
  SpellEntrySave,
  TemplateAdjustment,
```

- [ ] **Step 9: Verify the project still type-checks.**

Run:

```
npm run check
```

Expected: PASS. No test changes yet; existing tests continue to pass because every new field is optional or additive.

- [ ] **Step 10: Commit.**

```
git add src/domain/types.ts src/domain/index.ts
git commit -m "Add adjustment types and optional structured ability/spell fields"
```

---

## Task 2: Create the pure derivation module `adjusted-view.ts`

**Files:**
- Create: `src/domain/creatures/adjusted-view.ts`
- Create: `src/domain/creatures/adjusted-view.test.ts`

This task lands a fresh module with no consumers. TDD: write a failing test first, implement, repeat.

- [ ] **Step 1: Write the failing test for `getEffectiveLevel`.**

Create `src/domain/creatures/adjusted-view.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import {
  adjustedAbility,
  adjustedAttack,
  adjustedDC,
  adjustedDamage,
  adjustedHp,
  adjustedSpellBlock,
  adjustedSpellEntry,
  getAdjustedView,
  getEffectiveLevel
} from './adjusted-view';
import type {
  Ability,
  Attack,
  CombatantState,
  CreatureSnapshot,
  DamageComponent,
  SpellListEntry,
  SpellcastingBlock
} from '../types';

describe('getEffectiveLevel', () => {
  test('elite adds +1, or +2 when starting at level <= 0', () => {
    expect(getEffectiveLevel(5, 'elite')).toBe(6);
    expect(getEffectiveLevel(1, 'elite')).toBe(2);
    expect(getEffectiveLevel(0, 'elite')).toBe(2);
    expect(getEffectiveLevel(-1, 'elite')).toBe(1);
  });

  test('weak subtracts 1, or 2 when starting at level 1', () => {
    expect(getEffectiveLevel(5, 'weak')).toBe(4);
    expect(getEffectiveLevel(2, 'weak')).toBe(1);
    expect(getEffectiveLevel(1, 'weak')).toBe(-1);
  });

  test('normal returns the input', () => {
    expect(getEffectiveLevel(5, 'normal')).toBe(5);
    expect(getEffectiveLevel(-1, 'normal')).toBe(-1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (module not yet created).**

Run:

```
npx vitest run src/domain/creatures/adjusted-view.test.ts
```

Expected: FAIL — module `./adjusted-view` cannot be resolved.

- [ ] **Step 3: Create the module with the minimum needed to make Step 1 pass.**

Create `src/domain/creatures/adjusted-view.ts`:

```ts
import type {
  Ability,
  Attack,
  CombatantState,
  CreatureBaseStats,
  CreatureSnapshot,
  DamageComponent,
  SpellListEntry,
  SpellcastingBlock,
  SpellcastingType,
  TemplateAdjustment
} from '../types';

const STAT_DELTA: Record<TemplateAdjustment, number> = {
  normal: 0,
  elite: 2,
  weak: -2
};

export function getEffectiveLevel(baseLevel: number, adjustment: TemplateAdjustment): number {
  if (adjustment === 'elite') {
    return baseLevel <= 0 ? baseLevel + 2 : baseLevel + 1;
  }
  if (adjustment === 'weak') {
    return baseLevel === 1 ? baseLevel - 2 : baseLevel - 1;
  }
  return baseLevel;
}

export function adjustedDC(dc: number, adjustment: TemplateAdjustment): number {
  return dc + STAT_DELTA[adjustment];
}

export function adjustedHp(baseHp: number, baseLevel: number, adjustment: TemplateAdjustment): number {
  if (adjustment === 'normal') return baseHp;
  if (adjustment === 'elite') return baseHp + eliteHpIncrease(baseLevel);
  return Math.max(1, baseHp - weakHpDecrease(baseLevel));
}

function eliteHpIncrease(level: number): number {
  if (level <= 1) return 10;
  if (level <= 4) return 15;
  if (level <= 19) return 20;
  return 30;
}

function weakHpDecrease(level: number): number {
  if (level <= 2) return 10;
  if (level <= 5) return 15;
  if (level <= 20) return 20;
  return 30;
}

export function adjustedDamage(
  components: DamageComponent[],
  adjustment: TemplateAdjustment,
  opts: { limitedUse: boolean; primaryIndex: number }
): DamageComponent[] {
  if (adjustment === 'normal' || components.length === 0) return components.map((c) => ({ ...c }));
  const magnitude = opts.limitedUse ? 4 : 2;
  const delta = adjustment === 'elite' ? magnitude : -magnitude;
  const index = opts.primaryIndex >= 0 && opts.primaryIndex < components.length ? opts.primaryIndex : 0;
  return components.map((component, i) => {
    if (i !== index) return { ...component };
    const base = component.bonus ?? 0;
    return { ...component, bonus: base + delta };
  });
}

export function adjustedAttack(attack: Attack, adjustment: TemplateAdjustment): Attack {
  if (adjustment === 'normal') return { ...attack, damage: attack.damage.map((c) => ({ ...c })) };
  return {
    ...attack,
    modifier: attack.modifier + STAT_DELTA[adjustment],
    damage: adjustedDamage(attack.damage, adjustment, {
      limitedUse: false,
      primaryIndex: attack.primaryDamageIndex ?? 0
    })
  };
}

export function adjustedAbility(ability: Ability, adjustment: TemplateAdjustment): Ability {
  if (adjustment === 'normal') return { ...ability };
  const next: Ability = { ...ability };
  if (ability.save) {
    next.save = { ...ability.save, dc: adjustedDC(ability.save.dc, adjustment) };
  }
  if (ability.damage && ability.damage.length > 0) {
    next.damage = adjustedDamage(ability.damage, adjustment, {
      limitedUse: ability.isLimitedUse ?? false,
      primaryIndex: 0
    });
  }
  return next;
}

export function adjustedSpellBlock(block: SpellcastingBlock, adjustment: TemplateAdjustment): SpellcastingBlock {
  if (adjustment === 'normal') return { ...block, entries: block.entries.map((e) => ({ ...e })) };
  const next: SpellcastingBlock = {
    ...block,
    dc: adjustedDC(block.dc, adjustment),
    entries: block.entries.map((entry) => adjustedSpellEntry(entry, block.type, adjustment))
  };
  if (block.attackModifier !== undefined) {
    next.attackModifier = block.attackModifier + STAT_DELTA[adjustment];
  }
  return next;
}

export function adjustedSpellEntry(
  entry: SpellListEntry,
  blockType: SpellcastingType,
  adjustment: TemplateAdjustment
): SpellListEntry {
  if (adjustment === 'normal') return { ...entry };
  if (!entry.damage || entry.damage.length === 0) return { ...entry };
  return {
    ...entry,
    damage: adjustedDamage(entry.damage, adjustment, {
      limitedUse: isLimitedUseSpell(entry, blockType),
      primaryIndex: 0
    })
  };
}

function isLimitedUseSpell(entry: SpellListEntry, blockType: SpellcastingType): boolean {
  if (entry.isCantrip) return false;
  if (entry.frequency?.type === 'atWill' || entry.frequency?.type === 'constant') return false;
  if (entry.frequency?.type === 'perDay') return true;
  // Slotted prepared/spontaneous spells are limited-use; focus spells too.
  return blockType === 'prepared' || blockType === 'spontaneous' || blockType === 'focus';
}

export interface AdjustedView extends CreatureBaseStats {
  level: number;
}

export function getAdjustedView(combatant: CombatantState): AdjustedView {
  // Will be wired to combatant.baseSnapshot after Task 5; for now this is a
  // forward-compatible signature kept commented until that task lands.
  throw new Error('getAdjustedView is wired in Task 5');
}
```

- [ ] **Step 4: Run the test to verify Step 1 now passes.**

```
npx vitest run src/domain/creatures/adjusted-view.test.ts -t 'getEffectiveLevel'
```

Expected: 3 tests passing.

- [ ] **Step 5: Add failing tests for `adjustedHp`, `adjustedDC`, `adjustedDamage`.**

Append to `adjusted-view.test.ts`:

```ts
describe('adjustedHp', () => {
  test('uses Monster Core HP bands from the starting level for elite', () => {
    expect(adjustedHp(8, -1, 'elite')).toBe(18);
    expect(adjustedHp(18, 1, 'elite')).toBe(28);
    expect(adjustedHp(30, 2, 'elite')).toBe(45);
    expect(adjustedHp(70, 5, 'elite')).toBe(90);
    expect(adjustedHp(360, 20, 'elite')).toBe(390);
  });

  test('uses Monster Core HP bands from the starting level for weak', () => {
    expect(adjustedHp(12, 0, 'weak')).toBe(2);
    expect(adjustedHp(30, 2, 'weak')).toBe(20);
    expect(adjustedHp(45, 3, 'weak')).toBe(30);
    expect(adjustedHp(90, 6, 'weak')).toBe(70);
    expect(adjustedHp(400, 21, 'weak')).toBe(370);
  });

  test('floors weak HP at 1', () => {
    expect(adjustedHp(6, 2, 'weak')).toBe(1);
  });

  test('normal passes through', () => {
    expect(adjustedHp(42, 5, 'normal')).toBe(42);
  });
});

describe('adjustedDC', () => {
  test('elite +2, weak -2, normal unchanged', () => {
    expect(adjustedDC(20, 'elite')).toBe(22);
    expect(adjustedDC(20, 'weak')).toBe(18);
    expect(adjustedDC(20, 'normal')).toBe(20);
  });
});

describe('adjustedDamage', () => {
  const physical: DamageComponent = { dice: 2, dieSize: 8, bonus: 5, type: 'piercing' };
  const fireRider: DamageComponent = { dice: 1, dieSize: 6, type: 'fire' };

  test('adds ±2 to bonus of the primary component for non-limited damage', () => {
    const out = adjustedDamage([physical, fireRider], 'elite', { limitedUse: false, primaryIndex: 0 });
    expect(out[0]).toEqual({ dice: 2, dieSize: 8, bonus: 7, type: 'piercing' });
    expect(out[1]).toEqual(fireRider);
  });

  test('respects primaryIndex when the physical line is not first', () => {
    const out = adjustedDamage([fireRider, physical], 'elite', { limitedUse: false, primaryIndex: 1 });
    expect(out[0]).toEqual(fireRider);
    expect(out[1]).toEqual({ dice: 2, dieSize: 8, bonus: 7, type: 'piercing' });
  });

  test('uses ±4 for limited-use damage', () => {
    const out = adjustedDamage([physical], 'elite', { limitedUse: true, primaryIndex: 0 });
    expect(out[0].bonus).toBe(9);
    const weak = adjustedDamage([physical], 'weak', { limitedUse: true, primaryIndex: 0 });
    expect(weak[0].bonus).toBe(1);
  });

  test('treats a missing bonus as 0', () => {
    const out = adjustedDamage([fireRider], 'elite', { limitedUse: false, primaryIndex: 0 });
    expect(out[0]).toEqual({ ...fireRider, bonus: 2 });
  });

  test('falls back to index 0 when primaryIndex is out of range', () => {
    const out = adjustedDamage([physical], 'elite', { limitedUse: false, primaryIndex: 5 });
    expect(out[0].bonus).toBe(7);
  });

  test('returns a defensive copy for normal', () => {
    const input = [physical];
    const out = adjustedDamage(input, 'normal', { limitedUse: false, primaryIndex: 0 });
    expect(out[0]).toEqual(physical);
    expect(out[0]).not.toBe(input[0]);
  });
});
```

- [ ] **Step 6: Run all `adjusted-view.test.ts` tests.**

```
npx vitest run src/domain/creatures/adjusted-view.test.ts
```

Expected: all passing (the implementation in Step 3 already covers them).

- [ ] **Step 7: Add failing tests for `adjustedAttack`, `adjustedAbility`, `adjustedSpellBlock`, `adjustedSpellEntry`.**

Append:

```ts
describe('adjustedAttack', () => {
  const attack: Attack = {
    name: 'claw',
    type: 'melee',
    modifier: 15,
    traits: ['agile'],
    damage: [
      { dice: 2, dieSize: 8, bonus: 5, type: 'slashing' },
      { dice: 1, dieSize: 6, type: 'fire' }
    ]
  };

  test('elite shifts modifier and primary damage', () => {
    const out = adjustedAttack(attack, 'elite');
    expect(out.modifier).toBe(17);
    expect(out.damage).toEqual([
      { dice: 2, dieSize: 8, bonus: 7, type: 'slashing' },
      { dice: 1, dieSize: 6, type: 'fire' }
    ]);
  });

  test('weak shifts modifier and primary damage', () => {
    const out = adjustedAttack(attack, 'weak');
    expect(out.modifier).toBe(13);
    expect(out.damage[0].bonus).toBe(3);
  });

  test('respects an explicit primaryDamageIndex', () => {
    const withRiderFirst: Attack = {
      ...attack,
      damage: [
        { dice: 1, dieSize: 6, type: 'fire' },
        { dice: 2, dieSize: 8, bonus: 5, type: 'slashing' }
      ],
      primaryDamageIndex: 1
    };
    const out = adjustedAttack(withRiderFirst, 'elite');
    expect(out.damage[0]).toEqual({ dice: 1, dieSize: 6, type: 'fire' });
    expect(out.damage[1]).toEqual({ dice: 2, dieSize: 8, bonus: 7, type: 'slashing' });
  });

  test('normal returns a structural clone', () => {
    const out = adjustedAttack(attack, 'normal');
    expect(out).toEqual(attack);
    expect(out.damage).not.toBe(attack.damage);
  });
});

describe('adjustedAbility', () => {
  const baseAbility: Ability = {
    name: 'Petrifying Gaze',
    actions: 2,
    description: 'DC 22 Fortitude or slowed 1.',
    save: { defense: 'fortitude', dc: 22 }
  };

  test('shifts structured save DC for elite/weak', () => {
    expect(adjustedAbility(baseAbility, 'elite').save?.dc).toBe(24);
    expect(adjustedAbility(baseAbility, 'weak').save?.dc).toBe(20);
    expect(adjustedAbility(baseAbility, 'normal').save?.dc).toBe(22);
  });

  test('passes through abilities with no structured save or damage', () => {
    const plain: Ability = { name: 'Scuttle', description: 'Hard to pin down.' };
    expect(adjustedAbility(plain, 'elite')).toEqual(plain);
  });

  test('applies ±4 to limited-use ability damage', () => {
    const breath: Ability = {
      name: 'Breath Weapon',
      description: '4d6 fire.',
      damage: [{ dice: 4, dieSize: 6, type: 'fire' }],
      isLimitedUse: true,
      save: { defense: 'reflex', dc: 20, basic: true }
    };
    const elite = adjustedAbility(breath, 'elite');
    expect(elite.damage?.[0]).toEqual({ dice: 4, dieSize: 6, type: 'fire', bonus: 4 });
    expect(elite.save?.dc).toBe(22);
  });

  test('applies ±2 to at-will damaging ability', () => {
    const ability: Ability = {
      name: 'Searing Glare',
      description: '1d6 fire.',
      damage: [{ dice: 1, dieSize: 6, type: 'fire' }]
    };
    expect(adjustedAbility(ability, 'elite').damage?.[0].bonus).toBe(2);
    expect(adjustedAbility(ability, 'weak').damage?.[0].bonus).toBe(-2);
  });
});

describe('adjustedSpellBlock and adjustedSpellEntry', () => {
  const block: SpellcastingBlock = {
    blockId: 'arcane',
    name: 'Arcane',
    tradition: 'arcane',
    type: 'prepared',
    dc: 20,
    attackModifier: 12,
    slots: { 1: 2 },
    entries: [
      { spellSlug: 'heal', name: 'Heal', level: 1 },
      {
        spellSlug: 'fireball',
        name: 'Fireball',
        level: 3,
        damage: [{ dice: 6, dieSize: 6, type: 'fire' }]
      }
    ]
  };

  test('shifts block dc and attackModifier', () => {
    const out = adjustedSpellBlock(block, 'elite');
    expect(out.dc).toBe(22);
    expect(out.attackModifier).toBe(14);
  });

  test('applies ±4 to slotted spell damage', () => {
    const out = adjustedSpellBlock(block, 'elite');
    expect(out.entries[1].damage?.[0]).toEqual({ dice: 6, dieSize: 6, type: 'fire', bonus: 4 });
  });

  test('cantrip damage is not limited-use', () => {
    const cantripBlock: SpellcastingBlock = {
      ...block,
      type: 'innate',
      entries: [
        {
          spellSlug: 'ignition',
          name: 'Ignition',
          level: 1,
          isCantrip: true,
          frequency: { type: 'atWill' },
          damage: [{ dice: 1, dieSize: 4, type: 'fire' }]
        }
      ]
    };
    const out = adjustedSpellBlock(cantripBlock, 'elite');
    expect(out.entries[0].damage?.[0].bonus).toBe(2);
  });

  test('innate perDay spell damage is limited-use', () => {
    const innateBlock: SpellcastingBlock = {
      ...block,
      type: 'innate',
      slots: undefined,
      entries: [
        {
          spellSlug: 'fear',
          name: 'Fear',
          level: 1,
          frequency: { type: 'perDay', uses: 1 },
          damage: [{ dice: 1, dieSize: 6, type: 'mental' }]
        }
      ]
    };
    const out = adjustedSpellBlock(innateBlock, 'elite');
    expect(out.entries[0].damage?.[0].bonus).toBe(4);
  });
});
```

- [ ] **Step 8: Run the new tests.**

```
npx vitest run src/domain/creatures/adjusted-view.test.ts
```

Expected: all green.

- [ ] **Step 9: Commit.**

```
git add src/domain/creatures/adjusted-view.ts src/domain/creatures/adjusted-view.test.ts
git commit -m "Add pure adjusted-view derivation module"
```

---

## Task 3: Migrate `templates.ts` to delegate to the new module

**Files:**
- Modify: `src/domain/creatures/templates.ts`
- Modify: `src/domain/creatures/templates.test.ts`
- Modify: `src/domain/index.ts`

`applyEliteWeak` stays as a public API to minimise churn (it's used by `clone.ts` and exposed via `domain/index.ts`). It becomes a thin wrapper around the new helpers. `adjustedLevel` becomes an alias of `getEffectiveLevel` for the same reason.

- [ ] **Step 1: Replace `src/domain/creatures/templates.ts` with the delegating shim.**

```ts
import type { Creature, TemplateAdjustment } from '../types';
import {
  adjustedAttack,
  adjustedDC,
  adjustedHp,
  adjustedSpellBlock,
  getEffectiveLevel
} from './adjusted-view';

export type CreatureTemplateAdjustment = 'elite' | 'weak';

export function applyEliteWeak(creature: Creature, adjustment: CreatureTemplateAdjustment): Creature {
  const adj: TemplateAdjustment = adjustment;
  const next = structuredClone(creature);
  next.level = getEffectiveLevel(creature.level, adj);
  next.hp = adjustedHp(creature.hp, creature.level, adj);
  next.ac = adjustedDC(creature.ac, adj);
  next.fortitude = adjustedDC(creature.fortitude, adj);
  next.reflex = adjustedDC(creature.reflex, adj);
  next.will = adjustedDC(creature.will, adj);
  next.perception = adjustedDC(creature.perception, adj);
  next.skills = Object.fromEntries(
    Object.entries(creature.skills).map(([k, v]) => [k, adjustedDC(v, adj)])
  );
  next.attacks = creature.attacks.map((attack) => adjustedAttack(attack, adj));
  if (next.spellcasting) {
    next.spellcasting = next.spellcasting.map((b) => adjustedSpellBlock(b, adj));
  }
  return next;
}

export function adjustedLevel(level: number, adjustment: CreatureTemplateAdjustment): number {
  return getEffectiveLevel(level, adjustment);
}
```

Note: `adjustedDC` does the same `±2` arithmetic as the old shifts; reusing it avoids two implementations of "+2/-2."

- [ ] **Step 2: Run existing tests.**

```
npx vitest run src/domain/creatures/templates.test.ts
```

Expected: all green. No test changes needed — the public behavior of `applyEliteWeak` and `adjustedLevel` is identical.

- [ ] **Step 3: Run the full test suite.**

```
npm run test:run
```

Expected: all green.

- [ ] **Step 4: Type-check.**

```
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```
git add src/domain/creatures/templates.ts
git commit -m "Refactor applyEliteWeak to delegate to adjusted-view"
```

---

## Task 4: Add `baseSnapshot` to combatants (additive, no consumer changes yet)

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/creatures/clone.ts`
- Modify: `src/domain/party/factory.ts`
- Modify: `src/domain/test-support.ts`

Now we add `baseSnapshot` to `CombatantState`. `baseStats` and `level` stay for one more task; this is purely additive so the type-checker can stay green while consumers migrate in Task 5.

- [ ] **Step 1: Add `baseSnapshot` to `CombatantState`.**

In `src/domain/types.ts`:

```ts
export interface CombatantState {
  id: CombatantId;
  sourceId: string;
  name: string;
  sourceType: SourceType;
  masterId?: CombatantId;
  baseStats: CreatureBaseStats;          // removed in Task 5
  baseSnapshot: CreatureSnapshot;
  currentHp: number;
  tempHp: number;
  appliedEffects: AppliedEffect[];
  reactionUsedThisRound: boolean;
  isAlive: boolean;
  notes?: string;
  attacks: Attack[];
  passiveAbilities: Ability[];
  reactiveAbilities: Ability[];
  activeAbilities: Ability[];
  spellcasting?: CombatantSpellcasting[];
  traits?: string[];
  size?: CreatureSize;
  level?: number;                        // removed in Task 5; for now still set
  templateAdjustment?: TemplateAdjustment;
}
```

- [ ] **Step 2: Update `createCombatantFromCreature` to populate `baseSnapshot`.**

In `src/domain/creatures/clone.ts`, modify the returned object:

```ts
  const adj: TemplateAdjustment = adjustment ?? 'normal';
  const baseSnapshot: CreatureSnapshot = {
    level: creature.level,
    ac: creature.ac,
    fortitude: creature.fortitude,
    reflex: creature.reflex,
    will: creature.will,
    perception: creature.perception,
    hp: creature.hp,
    speed: primarySpeed(creature.speed),
    skills: cloneValue(creature.skills)
  };

  return {
    id: combatantId,
    sourceId: creature.id,
    name: name ?? combatantCreature.name,
    sourceType: 'creature',
    baseStats: { /* same as before — built from combatantCreature */ },
    baseSnapshot,
    /* …rest unchanged… */
    templateAdjustment: adj === 'normal' ? undefined : adj
  };
```

Add the import for `CreatureSnapshot` and `TemplateAdjustment` at the top.

- [ ] **Step 3: Update `createCombatantFromPartyMember` similarly.**

In `src/domain/party/factory.ts`, add `baseSnapshot` alongside `baseStats`:

```ts
const baseSnapshot = {
  level: partyMember.level,
  ac: partyMember.ac,
  fortitude: partyMember.fortitude,
  reflex: partyMember.reflex,
  will: partyMember.will,
  perception: partyMember.perception,
  hp: partyMember.hp,
  speed: primarySpeed(partyMember.speed),
  skills: structuredClone(partyMember.skills ?? {})
};

return {
  /* existing fields */,
  baseSnapshot,
  templateAdjustment: undefined
};
```

- [ ] **Step 4: Update the test-support builder to include `baseSnapshot`.**

In `src/domain/test-support.ts`, locate the combatant builder and add `baseSnapshot` mirroring `baseStats` (with `level` from the existing `level` field, defaulting to `1`).

- [ ] **Step 5: Run tests.**

```
npm run test:run
```

Expected: PASS. Existing assertions on `baseStats` still hold; the new field is unobserved.

- [ ] **Step 6: Commit.**

```
git add src/domain/types.ts src/domain/creatures/clone.ts src/domain/party/factory.ts src/domain/test-support.ts
git commit -m "Add baseSnapshot to combatants (additive)"
```

---

## Task 5: Wire `getAdjustedView` and migrate every reader

**Files:**
- Modify: `src/domain/creatures/adjusted-view.ts`
- Modify: `src/domain/creatures/adjusted-view.test.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/index.ts`
- Modify: `src/domain/creatures/clone.ts`
- Modify: `src/domain/party/factory.ts`
- Modify: `src/domain/reducer.ts`
- Modify: `src/domain/encounter-xp.ts`
- Modify: `src/domain/test-support.ts`
- Modify: `src/lib/encounter-app.ts`
- Modify: `src/lib/combat-log/format.test.ts`
- Modify: `src/components/CombatantCard.svelte`
- Modify: `src/components/CombatantDetailsPanel.svelte`
- Modify: `src/routes/+page.svelte`
- Modify all corresponding `*.test.ts` files
- Modify: `src/domain/creatures/clone.test.ts`
- Modify: `src/domain/party/factory.test.ts`
- Modify: `src/components/CombatantCard.test.ts`
- Modify: `src/components/CombatantDetailsPanel.test.ts`
- Modify: `src/lib/encounter-app.test.ts`
- Modify: `src/domain/reducer.test.ts`
- Modify: `src/domain/encounter-xp.test.ts`

The biggest task. We replace the placeholder `getAdjustedView` with the real implementation, drop `baseStats` and `level` from `CombatantState`, and update every reader to call `getAdjustedView(combatant)`.

- [ ] **Step 1: Replace the stub `getAdjustedView`.**

In `src/domain/creatures/adjusted-view.ts`:

```ts
export interface AdjustedView extends CreatureBaseStats {
  level: number;
  adjustment: TemplateAdjustment;
}

export function getAdjustedView(combatant: CombatantState): AdjustedView {
  const adj: TemplateAdjustment = combatant.templateAdjustment ?? 'normal';
  const snap = combatant.baseSnapshot;
  return {
    adjustment: adj,
    level: getEffectiveLevel(snap.level, adj),
    hp: adjustedHp(snap.hp, snap.level, adj),
    ac: adjustedDC(snap.ac, adj),
    fortitude: adjustedDC(snap.fortitude, adj),
    reflex: adjustedDC(snap.reflex, adj),
    will: adjustedDC(snap.will, adj),
    perception: adjustedDC(snap.perception, adj),
    speed: snap.speed,
    skills: Object.fromEntries(Object.entries(snap.skills).map(([k, v]) => [k, adjustedDC(v, adj)]))
  };
}
```

- [ ] **Step 2: Add a test for `getAdjustedView`.**

Append to `adjusted-view.test.ts`:

```ts
describe('getAdjustedView', () => {
  test('returns snapshot values for normal adjustment', () => {
    const view = getAdjustedView(combatantFixture('normal'));
    expect(view).toMatchObject({
      adjustment: 'normal',
      level: 5,
      ac: 20,
      hp: 42,
      fortitude: 14,
      reflex: 12,
      will: 10,
      perception: 13,
      speed: 30,
      skills: { athletics: 15, stealth: 11 }
    });
  });

  test('shifts numeric stats and recomputes HP for elite', () => {
    const view = getAdjustedView(combatantFixture('elite'));
    expect(view).toMatchObject({
      adjustment: 'elite',
      level: 6,
      ac: 22,
      hp: 62,
      fortitude: 16,
      reflex: 14,
      will: 12,
      perception: 15,
      skills: { athletics: 17, stealth: 13 }
    });
  });

  test('shifts numeric stats and recomputes HP for weak with floor', () => {
    const view = getAdjustedView(combatantFixture('weak', { hp: 6, level: 2 }));
    expect(view.hp).toBe(1);
    expect(view.ac).toBe(18);
  });
});

function combatantFixture(
  adjustment: TemplateAdjustment,
  overrides: Partial<CreatureSnapshot> = {}
): CombatantState {
  const snap: CreatureSnapshot = {
    level: 5,
    ac: 20,
    fortitude: 14,
    reflex: 12,
    will: 10,
    perception: 13,
    hp: 42,
    speed: 30,
    skills: { athletics: 15, stealth: 11 },
    ...overrides
  };
  return {
    id: 'c1',
    sourceId: 's',
    name: 'Test',
    sourceType: 'creature',
    baseSnapshot: snap,
    baseStats: {
      hp: snap.hp,
      ac: snap.ac,
      fortitude: snap.fortitude,
      reflex: snap.reflex,
      will: snap.will,
      perception: snap.perception,
      speed: snap.speed,
      skills: { ...snap.skills }
    },
    currentHp: snap.hp,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: [],
    templateAdjustment: adjustment === 'normal' ? undefined : adjustment
  };
}
```

- [ ] **Step 3: Run new test.**

```
npx vitest run src/domain/creatures/adjusted-view.test.ts -t 'getAdjustedView'
```

Expected: 3 passing.

- [ ] **Step 4: Remove `baseStats` and `level` from `CombatantState`.**

In `src/domain/types.ts`, change `CombatantState`:

```ts
export interface CombatantState {
  id: CombatantId;
  sourceId: string;
  name: string;
  sourceType: SourceType;
  masterId?: CombatantId;
  baseSnapshot: CreatureSnapshot;
  templateAdjustment: TemplateAdjustment;
  currentHp: number;
  tempHp: number;
  appliedEffects: AppliedEffect[];
  reactionUsedThisRound: boolean;
  isAlive: boolean;
  notes?: string;
  attacks: Attack[];
  passiveAbilities: Ability[];
  reactiveAbilities: Ability[];
  activeAbilities: Ability[];
  spellcasting?: CombatantSpellcasting[];
  traits?: string[];
  size?: CreatureSize;
}
```

Note: `templateAdjustment` becomes required and defaults to `'normal'`.

- [ ] **Step 5: Update `createCombatantFromCreature` in `src/domain/creatures/clone.ts` to drop `baseStats` and `level` and set `templateAdjustment: adj` always.**

```ts
  return {
    id: combatantId,
    sourceId: creature.id,
    name: name ?? combatantCreature.name,
    sourceType: 'creature',
    baseSnapshot,
    templateAdjustment: adj,
    currentHp: combatantCreature.hp,
    tempHp: 0,
    appliedEffects: [],
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: cloneValue(combatantCreature.attacks),
    passiveAbilities: cloneValue(combatantCreature.passiveAbilities),
    reactiveAbilities: cloneValue(combatantCreature.reactiveAbilities),
    activeAbilities: cloneValue(combatantCreature.activeAbilities),
    spellcasting: combatantCreature.spellcasting ? hydrateSpellcasting(combatantCreature.spellcasting) : undefined,
    traits: cloneValue(combatantCreature.traits),
    size: combatantCreature.size
  };
```

Important: `currentHp` is set from `combatantCreature.hp` — i.e. the **adjusted** max — because `combatantCreature = applyEliteWeak(creature, adj)`. Snapshot captures the original. The combatant's `attacks`/`abilities`/`spellcasting` arrays still hold the *pre-adjustment* prose; UI will run them through `adjusted*` helpers at render time.

Actually correct that — to keep `attacks/abilities/spellcasting` consistent with the snapshot model (unadjusted, adjusted at render time), we must clone them from `creature`, not `combatantCreature`. Update:

```ts
    attacks: cloneValue(creature.attacks),
    passiveAbilities: cloneValue(creature.passiveAbilities),
    reactiveAbilities: cloneValue(creature.reactiveAbilities),
    activeAbilities: cloneValue(creature.activeAbilities),
    spellcasting: creature.spellcasting ? hydrateSpellcasting(creature.spellcasting) : undefined,
    traits: cloneValue(creature.traits),
    size: creature.size
```

And `currentHp` becomes `adjustedHp(creature.hp, creature.level, adj)`. Add the imports.

The local `applyEliteWeak` call becomes unnecessary — remove `combatantCreature` and use `creature` everywhere. Add import: `import { adjustedHp } from './adjusted-view';`

- [ ] **Step 6: Update `createCombatantFromPartyMember` in `src/domain/party/factory.ts`.**

```ts
  return {
    id: combatantId,
    sourceId: partyMember.id,
    name: name ?? partyMember.name,
    sourceType: 'partyMember',
    baseSnapshot: {
      level: partyMember.level,
      ac: partyMember.ac,
      fortitude: partyMember.fortitude,
      reflex: partyMember.reflex,
      will: partyMember.will,
      perception: partyMember.perception,
      hp: partyMember.hp,
      speed: primarySpeed(partyMember.speed),
      skills: structuredClone(partyMember.skills ?? {})
    },
    templateAdjustment: 'normal',
    currentHp: partyMember.hp,
    tempHp: 0,
    appliedEffects: expandPersistentEffects(partyMember.persistentEffects, combatantId),
    reactionUsedThisRound: false,
    isAlive: true,
    attacks: [],
    passiveAbilities: [],
    reactiveAbilities: [],
    activeAbilities: []
  };
```

- [ ] **Step 7: Update `src/domain/reducer.ts` healing cap.**

Find the two `combatant.baseStats.hp` references (around lines 821 and 884) and replace with `getAdjustedView(combatant).hp`. Add at the top:

```ts
import { getAdjustedView } from './creatures/adjusted-view';
```

Example at the healing site:

```ts
const maxHp = getAdjustedView(combatant).hp;
const nextHp = Math.min(combatant.currentHp + amount, maxHp);
```

- [ ] **Step 8: Update `src/domain/encounter-xp.ts` to use `getEffectiveLevel`.**

Find all reads of `combatant.level` and replace with:

```ts
import { getEffectiveLevel } from './creatures/adjusted-view';
// …
const effectiveLevel = getEffectiveLevel(combatant.baseSnapshot.level, combatant.templateAdjustment);
```

- [ ] **Step 9: Update `src/lib/encounter-app.ts` `computeCombatantStats`.**

```ts
import { getAdjustedView } from '../domain/creatures/adjusted-view';

export function computeCombatantStats(combatant: CombatantState): ComputedStats {
  return deriveStats(getAdjustedView(combatant), combatant.appliedEffects, effectLibrary);
}
```

`deriveStats` already expects a `CreatureBaseStats`-shaped argument; `AdjustedView extends CreatureBaseStats`, so this is a structural fit.

- [ ] **Step 10: Update `src/domain/test-support.ts` to remove `baseStats` and `level` and set `baseSnapshot` + `templateAdjustment: 'normal'`.**

Add the snapshot mirroring the previously-asserted base values. Keep `templateAdjustment: 'normal'` by default; let the existing `overrides` parameter still accept arbitrary partial overrides.

- [ ] **Step 11: Update `src/domain/index.ts` to export `getAdjustedView`.**

Add at the function exports:

```ts
export { adjustedAbility, adjustedAttack, adjustedDC, adjustedDamage, adjustedHp, adjustedSpellBlock, adjustedSpellEntry, getAdjustedView, getEffectiveLevel } from './creatures/adjusted-view';
```

Add type export `AdjustedView`.

- [ ] **Step 12: Update tests that constructed `CombatantState` manually.**

For each file that builds a `CombatantState` literal (search: `baseStats: { hp:` and `level: <n>` in a combatant context):

- `src/lib/combat-log/format.test.ts`
- `src/lib/encounter-app.test.ts`
- `src/components/CombatantCard.test.ts`
- `src/components/CombatantDetailsPanel.test.ts`
- `src/domain/creatures/clone.test.ts`
- `src/domain/party/factory.test.ts`
- `src/domain/encounter-xp.test.ts`
- `src/domain/reducer.test.ts` (any explicit builds)

Replace each `baseStats: {…}` with a `baseSnapshot: {…}` of the same shape **plus a `level` field** (use whatever level the test was using), and remove the standalone `level:` field on the combatant. Add `templateAdjustment: 'normal'` (or `'elite'`/`'weak'` when the test asserted that adjustment).

For tests that read `combatant.baseStats.X` to seed effect-derivation tests, switch to `combatant.baseSnapshot.X` (the *unadjusted* value) or call `getAdjustedView(combatant).X` depending on intent. The existing `effects/derivation.test.ts` files build their own `CreatureBaseStats` and feed `deriveStats` directly — those are fine, `CreatureBaseStats` the **type** still exists.

For combatant-shape assertions in `clone.test.ts` and `party/factory.test.ts`, replace `expect(combatant.baseStats).toEqual(…)` with `expect(combatant.baseSnapshot).toEqual(…)` and add a separate `expect(getAdjustedView(combatant)).toEqual(…)` when the test was specifically checking adjusted values.

- [ ] **Step 13: Update Svelte components.**

In `src/components/CombatantCard.svelte`:

```svelte
<script lang="ts">
  import { getAdjustedView } from '../domain';
  // …
  $: adjustedView = getAdjustedView(combatant);
</script>
…
Math.min(100, (combatant.currentHp / adjustedView.hp) * 100)
…
displayAriaLabel={`HP ${combatant.currentHp} of ${adjustedView.hp}, click to edit`}
…
<span class="hp-max">/ {adjustedView.hp}</span>
```

In `src/components/CombatantDetailsPanel.svelte`, replace every `combatant.baseStats.*` with `adjustedView.*` (where `adjustedView` is computed as above). Replace `combatant.level !== undefined ? \`Level ${combatant.level}\`` with `Level ${adjustedView.level}`.

In `src/routes/+page.svelte`, the two `combatant.baseStats.hp` references and the `radialCombatant.baseStats.hp` / `effectModalCombatant.baseStats.hp` calls get the same treatment — compute `getAdjustedView` once where the combatant is in scope.

- [ ] **Step 14: Run the whole suite and `check`.**

```
npm run check && npm run test:run
```

Expected: PASS. Fix any straggler `combatant.baseStats` or `combatant.level` reads that compile-time flags.

- [ ] **Step 15: Commit.**

```
git add -A
git commit -m "Replace CombatantState.baseStats/level with baseSnapshot + templateAdjustment"
```

---

## Task 6: Add `SET_TEMPLATE_ADJUSTMENT` reducer handler

**Files:**
- Modify: `src/domain/reducer.ts`
- Modify: `src/domain/reducer.test.ts`

The `Command` and `DomainEvent` shapes were added in Task 1. Now the reducer learns to handle it.

- [ ] **Step 1: Add a failing reducer test.**

In `src/domain/reducer.test.ts`, add a new `describe` block:

```ts
import { applyCommand } from './reducer';
import { effectLibrary } from './effects/library';
import { newEncounterState } from '../lib/encounter-app';
// or whatever helper already exists in this test file's imports
// (use whatever the test file uses to build encounter state)

describe('SET_TEMPLATE_ADJUSTMENT', () => {
  test('elite → max HP grows; currentHp unchanged; event emitted', () => {
    // build state with one full-HP normal goblin (level 1, hp 18) using the existing test builders
    const state = /* … */;
    const result = applyCommand(
      state,
      {
        id: 'cmd-1',
        type: 'SET_TEMPLATE_ADJUSTMENT',
        payload: { combatantId: 'goblin-1', adjustment: 'elite' }
      },
      effectLibrary
    );
    const c = result.newState.combatants['goblin-1'];
    expect(c.templateAdjustment).toBe('elite');
    expect(c.currentHp).toBe(18); // unchanged
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: 'template-adjustment-changed',
        combatantId: 'goblin-1',
        from: 'normal',
        to: 'elite',
        hpMaxFrom: 18,
        hpMaxTo: 28,
        currentHpFrom: 18,
        currentHpTo: 18
      })
    );
  });

  test('weak → max HP shrinks; currentHp clamped to new max', () => {
    // start as an elite at full HP (max 28), switch to weak (max 8 from base 18)
    // expect currentHp = 8
  });

  test('rejects party member combatants', () => {
    // build state with a partyMember combatant, attempt SET_TEMPLATE_ADJUSTMENT
    const result = applyCommand(state, cmd, effectLibrary);
    expect(result.events[0]).toMatchObject({ type: 'command-rejected' });
  });

  test('no-op when adjustment is unchanged', () => {
    // sending elite to an elite combatant emits no template-adjustment-changed event
  });
});
```

Use whatever combatant-construction helpers already exist in `reducer.test.ts` for state setup (look for the existing pattern — likely `setupEncounterWithCombatants` or similar).

- [ ] **Step 2: Run the test to confirm failure.**

```
npx vitest run src/domain/reducer.test.ts -t 'SET_TEMPLATE_ADJUSTMENT'
```

Expected: FAIL — the reducer falls through to the default reject case.

- [ ] **Step 3: Add `allowedPhases` entry for the new command.**

In `src/domain/reducer.ts`, add to the `allowedPhases` map:

```ts
  SET_TEMPLATE_ADJUSTMENT: ['PREPARING', 'ACTIVE', 'RESOLVING']
```

- [ ] **Step 4: Add a case to the `switch (command.type)` block.**

```ts
case 'SET_TEMPLATE_ADJUSTMENT':
  return setTemplateAdjustment(state, command.payload.combatantId, command.payload.adjustment);
```

- [ ] **Step 5: Add the `setTemplateAdjustment` function near the other per-combatant handlers.**

```ts
function setTemplateAdjustment(
  state: EncounterState,
  combatantId: CombatantId,
  adjustment: TemplateAdjustment
): CommandResult {
  const target = state.combatants[combatantId];
  if (!target) {
    return reject(state, 'SET_TEMPLATE_ADJUSTMENT', `Combatant ${combatantId} not found`);
  }
  if (target.sourceType !== 'creature') {
    return reject(
      state,
      'SET_TEMPLATE_ADJUSTMENT',
      `Combatant ${combatantId} is not a creature (sourceType=${target.sourceType})`
    );
  }
  if (target.templateAdjustment === adjustment) {
    return { newState: state, events: [] };
  }

  const hpMaxFrom = getAdjustedView(target).hp;
  const next: CombatantState = { ...target, templateAdjustment: adjustment };
  const hpMaxTo = getAdjustedView(next).hp;
  const currentHpFrom = target.currentHp;
  const currentHpTo = Math.min(target.currentHp, hpMaxTo);

  const updated: CombatantState = { ...next, currentHp: currentHpTo };

  return {
    newState: { ...state, combatants: { ...state.combatants, [combatantId]: updated } },
    events: [
      {
        type: 'template-adjustment-changed',
        combatantId,
        from: target.templateAdjustment,
        to: adjustment,
        hpMaxFrom,
        hpMaxTo,
        currentHpFrom,
        currentHpTo
      }
    ]
  };
}
```

Add `TemplateAdjustment` to the type imports at the top of the file.

- [ ] **Step 6: Run the new reducer tests.**

```
npx vitest run src/domain/reducer.test.ts -t 'SET_TEMPLATE_ADJUSTMENT'
```

Expected: PASS.

- [ ] **Step 7: Run the full suite + check.**

```
npm run check && npm run test:run
```

Expected: PASS.

- [ ] **Step 8: Commit.**

```
git add src/domain/reducer.ts src/domain/reducer.test.ts
git commit -m "Add SET_TEMPLATE_ADJUSTMENT command and reducer"
```

---

## Task 7: Add `dispatchSetTemplateAdjustment` to the orchestrator

**Files:**
- Modify: `src/lib/encounter-app.ts`
- Modify: `src/lib/encounter-app.test.ts`

The orchestrator already exposes `dispatchEncounterCommand`. We add a typed builder and a thin wrapper so UI dispatch is symmetric with the existing pattern.

- [ ] **Step 1: Add a failing test.**

In `src/lib/encounter-app.test.ts`, add:

```ts
test('setTemplateAdjustmentCommand dispatches and toggles adjustment', () => {
  const state = /* existing builder with a creature combatant 'goblin-1' (normal) */;
  const result = dispatchEncounterCommand(state, feedback, setTemplateAdjustmentCommand('goblin-1', 'elite'));
  expect(result.combatants['goblin-1'].templateAdjustment).toBe('elite');
});
```

- [ ] **Step 2: Verify failure.**

```
npx vitest run src/lib/encounter-app.test.ts -t 'setTemplateAdjustmentCommand'
```

Expected: FAIL — `setTemplateAdjustmentCommand` is undefined.

- [ ] **Step 3: Add the builder + dispatcher to `src/lib/encounter-app.ts`.**

Below the existing command builders:

```ts
export function setTemplateAdjustmentCommand(
  combatantId: CombatantId,
  adjustment: TemplateAdjustment
): Command {
  return {
    id: nextCommandId(),
    type: 'SET_TEMPLATE_ADJUSTMENT',
    payload: { combatantId, adjustment }
  };
}
```

`TemplateAdjustment` and `CombatantId` are already importable from `../domain`.

- [ ] **Step 4: Run the test and the full suite.**

```
npm run check && npm run test:run
```

Expected: PASS.

- [ ] **Step 5: Commit.**

```
git add src/lib/encounter-app.ts src/lib/encounter-app.test.ts
git commit -m "Add setTemplateAdjustmentCommand orchestrator builder"
```

---

## Task 8: UI — render adjusted attacks/abilities/spells in the details panel

**Files:**
- Modify: `src/components/CombatantDetailsPanel.svelte`
- Modify: `src/components/details/AttackRow.svelte`
- Modify: `src/components/details/AbilityCard.svelte`
- Modify: `src/components/details/SpellcastingBlockView.svelte`
- Modify: `src/components/CombatantDetailsPanel.test.ts`

Currently the panel renders `attack.damage` straight from the combatant. After Task 5 the combatant's attacks/abilities/spells are pre-adjustment. The panel must run them through `adjusted*` helpers.

- [ ] **Step 1: Compute adjusted views in the panel script.**

In `CombatantDetailsPanel.svelte`, just below `$: computed = …`:

```ts
import { adjustedAbility, adjustedAttack, adjustedSpellBlock } from '../domain';
// …
$: adjustment = combatant?.templateAdjustment ?? 'normal';
$: adjustedAttacks = combatant ? combatant.attacks.map((a) => adjustedAttack(a, adjustment)) : [];
$: adjustedPassive = combatant ? combatant.passiveAbilities.map((a) => adjustedAbility(a, adjustment)) : [];
$: adjustedReactive = combatant ? combatant.reactiveAbilities.map((a) => adjustedAbility(a, adjustment)) : [];
$: adjustedActive = combatant ? combatant.activeAbilities.map((a) => adjustedAbility(a, adjustment)) : [];
$: adjustedSpellcasting = combatant?.spellcasting
  ? combatant.spellcasting.map((b) => ({ ...adjustedSpellBlock(b, adjustment), usedSlots: b.usedSlots, usedFocusPoints: b.usedFocusPoints, usedEntries: b.usedEntries }))
  : undefined;
```

`spellcasting` carries usage state that we must preserve. The merge above keeps `used*` fields intact while substituting adjusted display values.

- [ ] **Step 2: Replace the consumer references in the template.**

Replace `{#each combatant.attacks as attack` with `{#each adjustedAttacks as attack`. Same for the three ability arrays and the spellcasting array.

- [ ] **Step 3: Add an "adjusted DC" badge inside `AbilityCard.svelte` when `save?.dc` is set.**

`AbilityCard.svelte`:

```svelte
{#if ability.save}
  <span class="ability__save-dc" title="Save target after adjustments">
    DC {ability.save.dc} {ability.save.defense}{ability.save.basic ? ' (basic)' : ''}
  </span>
{/if}
{#if ability.damage && ability.damage.length > 0}
  <span class="ability__damage">{formatDamage(ability.damage)}</span>
{/if}
```

Reuse the existing `formatDamage` helper from `$lib/abilities/format-damage`.

- [ ] **Step 4: Update `CombatantDetailsPanel.test.ts` for an elite combatant.**

Add a test:

```ts
test('renders adjusted attack damage and ability save DC for an elite combatant', () => {
  renderPanel(eliteFixtureWithSaveAbility());
  // assert that the rendered ability text shows DC 24 (base 22 + 2)
  // assert that the rendered attack damage shows +7 (base +5)
});
```

Where `eliteFixtureWithSaveAbility` builds a combatant whose `passiveAbilities[0].save = { defense: 'fortitude', dc: 22 }` and `attacks[0].damage[0].bonus = 5`.

- [ ] **Step 5: Run UI tests.**

```
npx vitest run src/components/CombatantDetailsPanel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full suite + check.**

```
npm run check && npm run test:run
```

- [ ] **Step 7: Commit.**

```
git add src/components/CombatantDetailsPanel.svelte src/components/details/AbilityCard.svelte src/components/CombatantDetailsPanel.test.ts
git commit -m "Render adjusted attacks and structured ability DCs in details panel"
```

---

## Task 9: UI — adjustment toggle inside the details panel header

**Files:**
- Modify: `src/components/CombatantDetailsPanel.svelte`
- Modify: `src/components/CombatantDetailsPanel.test.ts`
- Modify: `src/routes/+page.svelte`

A small Normal/Weak/Elite toggle next to the existing chip, disabled for non-creature combatants. Click dispatches `setTemplateAdjustmentCommand`.

- [ ] **Step 1: Add an `onSetAdjustment` prop to the panel.**

In `CombatantDetailsPanel.svelte` script:

```ts
import type { TemplateAdjustment } from '../domain';
export let onSetAdjustment: (combatantId: string, adjustment: TemplateAdjustment) => void = () => {};
```

- [ ] **Step 2: Render the toggle group in the header.**

Below the existing `<Chip>`:

```svelte
{#if combatant.sourceType === 'creature'}
  <div class="details__adjustment" role="group" aria-label="Template adjustment">
    {#each ['weak', 'normal', 'elite'] as opt (opt)}
      <button
        type="button"
        class="details__adjustment-opt"
        class:details__adjustment-opt--active={adjustment === opt}
        aria-pressed={adjustment === opt}
        onclick={() => onSetAdjustment(combatant.id, opt)}
      >{opt[0].toUpperCase() + opt.slice(1)}</button>
    {/each}
  </div>
{/if}
```

Reuse the existing `.adjustment__option` styles from `BestiarySection.svelte` (copy or extract — copy is fine for this slice).

- [ ] **Step 3: Wire the dispatch in `src/routes/+page.svelte`.**

Find where `CombatantDetailsPanel` is rendered and add:

```svelte
onSetAdjustment={(combatantId, adjustment) =>
  runCommand(setTemplateAdjustmentCommand(combatantId, adjustment))}
```

Import `setTemplateAdjustmentCommand` from `$lib/encounter-app`.

- [ ] **Step 4: Add a panel test for the toggle.**

```ts
test('clicking Elite calls onSetAdjustment with elite', async () => {
  const onSetAdjustment = vi.fn();
  const { getByText } = renderPanel(combatantFixture(), { onSetAdjustment });
  await fireEvent.click(getByText('Elite'));
  expect(onSetAdjustment).toHaveBeenCalledWith('combatant-1', 'elite');
});

test('toggle is not rendered for partyMember combatants', () => {
  const { queryByRole } = renderPanel(partyMemberCombatantFixture());
  expect(queryByRole('group', { name: 'Template adjustment' })).toBeNull();
});
```

- [ ] **Step 5: Run UI tests + full suite + check.**

```
npm run check && npm run test:run
```

Expected: PASS.

- [ ] **Step 6: Manually verify in the browser.**

```
npm run dev
```

In the browser: add a creature to the encounter, open its details panel, click each of Weak/Normal/Elite, confirm HP max and AC update without a re-add, and that wounding then switching weak clamps HP.

- [ ] **Step 7: Commit.**

```
git add src/components/CombatantDetailsPanel.svelte src/components/CombatantDetailsPanel.test.ts src/routes/+page.svelte
git commit -m "Add template adjustment toggle to combatant details panel"
```

---

## Task 10: YAML schema v2 — accept new optional fields

**Files:**
- Modify: `src/lib/yaml/creature-validator.ts`
- Modify: `src/lib/yaml/creature-validator.test.ts`

Bump the accepted `schemaVersion` set from `{1}` to `{1, 2}`. v2 documents may carry the new optional structured fields. v1 still loads. The validator's existing pattern (whatever it is — Zod, hand-rolled, etc.) should already accept unknown optional fields as long as the schema is `.passthrough()` / open; double-check by adding tests first.

- [ ] **Step 1: Add a failing acceptance test for a v2 document.**

In `src/lib/yaml/creature-validator.test.ts`:

```ts
test('accepts schemaVersion 2 with structured ability save and damage', () => {
  const yaml = `
kind: creature
schemaVersion: 2
data:
  id: test
  name: Test
  level: 5
  traits: []
  size: medium
  rarity: common
  ac: 20
  fortitude: 14
  reflex: 12
  will: 10
  perception: 13
  hp: 60
  immunities: []
  resistances: []
  weaknesses: []
  speed: { land: 30 }
  attacks:
    - name: jaws
      type: melee
      modifier: 15
      traits: []
      damage:
        - { dice: 2, dieSize: 8, bonus: 5, type: piercing }
      primaryDamageIndex: 0
  passiveAbilities: []
  reactiveAbilities: []
  activeAbilities:
    - name: Breath
      actions: 2
      description: 6d6 fire, basic Reflex DC 22.
      save: { defense: reflex, dc: 22, basic: true }
      damage: [ { dice: 6, dieSize: 6, type: fire } ]
      isLimitedUse: true
  skills: {}
  tags: []
`;
  const result = parseAndValidate(yaml);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.activeAbilities[0].save?.dc).toBe(22);
    expect(result.value.activeAbilities[0].isLimitedUse).toBe(true);
    expect(result.value.attacks[0].primaryDamageIndex).toBe(0);
  }
});

test('still accepts schemaVersion 1 documents unchanged', () => {
  // existing pattern in the file — should already pass without code changes
});
```

Use whatever the existing test harness in this file calls `parseAndValidate`.

- [ ] **Step 2: Run the test.**

```
npx vitest run src/lib/yaml/creature-validator.test.ts -t 'schemaVersion 2'
```

Expected: probably FAIL because the existing validator hard-checks `schemaVersion === 1`.

- [ ] **Step 3: Loosen the schemaVersion check.**

Find the check (likely a `if (envelope.schemaVersion !== 1)` or Zod literal) and change to accept `1` or `2`. Add optional schema entries for the new fields (`primaryDamageIndex`, `save`, `damage`, `isLimitedUse` on abilities; `save`, `damage` on spell list entries). If the validator currently strips unknown fields, add explicit allow-list entries so they pass through.

- [ ] **Step 4: Verify the test now passes and v1 fixtures still load.**

```
npx vitest run src/lib/yaml/creature-validator.test.ts
```

Expected: all passing.

- [ ] **Step 5: Commit.**

```
git add src/lib/yaml/creature-validator.ts src/lib/yaml/creature-validator.test.ts
git commit -m "Accept YAML schemaVersion 2 with structured ability and attack fields"
```

---

## Task 11: Foundry mapper — extract action damage/save and spell damage

**Files:**
- Modify: `src/lib/foundry/types.ts`
- Modify: `src/lib/foundry/mapper.ts`
- Modify: `src/lib/foundry/mapper.test.ts`
- Optional: add a fixture under `src/lib/foundry/fixtures/`

Foundry NPC JSON already carries action damage, save DC, and spell damage. Our mapper currently ignores them.

- [ ] **Step 1: Extend `FoundryActionSystem` and `FoundrySpellSystem` types.**

`src/lib/foundry/types.ts`:

```ts
export interface FoundryActionSystem {
  actionType?: { value?: FoundryActionType };
  actions?: { value?: number | null };
  category?: string;
  traits?: { value?: string[] };
  description?: { value?: string };
  frequency?: { max?: number; per?: string };
  damageRolls?: Record<string, { damage?: string; damageType?: string; category?: string | null }>;
  savingThrow?: { statistic?: 'fortitude' | 'reflex' | 'will'; dc?: number; basic?: boolean };
}

export interface FoundrySpellSystem {
  level?: { value?: number };
  location?: { value?: string; uses?: { max?: number; value?: number } };
  traits?: { value?: string[]; traditions?: string[] };
  time?: { value?: string };
  range?: { value?: string } | string;
  damage?: Record<string, { damage?: string; damageType?: string }>;
  defense?: { save?: { statistic?: 'fortitude' | 'reflex' | 'will'; basic?: boolean } };
}
```

- [ ] **Step 2: Extend `mapAbility` to pull damage, save, and limited-use.**

In `src/lib/foundry/mapper.ts`, update `mapAbility`:

```ts
function mapAbility(item: FoundryActionItem): Ability | null {
  if (typeof item.name !== 'string') return null;
  const sys: FoundryActionSystem = item.system ?? {};
  /* existing description/traits/actions/frequency assembly */

  const damage: DamageComponent[] = [];
  for (const roll of Object.values(sys.damageRolls ?? {})) {
    if (!roll) continue;
    const parsed = typeof roll.damage === 'string' ? parseDamageString(roll.damage) : null;
    if (!parsed) continue;
    parsed.type = typeof roll.damageType === 'string' && roll.damageType !== '' ? roll.damageType : 'untyped';
    if (roll.category === 'persistent') parsed.persistent = true;
    damage.push(parsed);
  }

  const save: AbilitySave | undefined = sys.savingThrow?.statistic && typeof sys.savingThrow?.dc === 'number'
    ? {
        defense: sys.savingThrow.statistic,
        dc: sys.savingThrow.dc,
        basic: sys.savingThrow.basic === true ? true : undefined
      }
    : undefined;

  const ability: Ability = { name: item.name, description };
  if (actions !== undefined) ability.actions = actions;
  if (traits !== undefined && traits.length > 0) ability.traits = traits;
  if (frequency !== undefined) ability.frequency = frequency;
  if (damage.length > 0) ability.damage = damage;
  if (save !== undefined) ability.save = save;
  if (sys.frequency && typeof sys.frequency.max === 'number') ability.isLimitedUse = true;
  return ability;
}
```

Import `AbilitySave` and `DamageComponent` from `../../domain`.

- [ ] **Step 3: Extend `mapSpellListEntry` to pull damage and save.**

```ts
function mapSpellListEntry(item: FoundrySpellItem, blockType: SpellcastingType): SpellListEntry | null {
  /* existing setup */
  const damage: DamageComponent[] = [];
  for (const roll of Object.values(sys.damage ?? {})) {
    if (!roll) continue;
    const parsed = typeof roll.damage === 'string' ? parseDamageString(roll.damage) : null;
    if (!parsed) continue;
    parsed.type = typeof roll.damageType === 'string' && roll.damageType !== '' ? roll.damageType : 'untyped';
    damage.push(parsed);
  }
  if (damage.length > 0) entry.damage = damage;
  const save = sys.defense?.save?.statistic;
  if (save) entry.save = { defense: save, basic: sys.defense?.save?.basic === true ? true : undefined };
  return entry;
}
```

- [ ] **Step 4: Add `primaryDamageIndex` detection to `mapAttack`.**

After the damage array is assembled:

```ts
const PHYSICAL: ReadonlySet<string> = new Set(['slashing', 'piercing', 'bludgeoning']);
const physicalIndex = damage.findIndex((d) => PHYSICAL.has(d.type));
if (physicalIndex > 0) out.primaryDamageIndex = physicalIndex;
```

If the physical line is at index 0, leave the field unset (it's the default).

- [ ] **Step 5: Add tests.**

In `src/lib/foundry/mapper.test.ts`:

```ts
test('maps action damageRolls and savingThrow into Ability.damage and Ability.save', () => {
  const doc = npcWithBreathAction(); // helper that builds an NPC JSON with damageRolls + savingThrow + frequency
  const result = mapFoundryNpcToCreature(doc);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const breath = result.value.activeAbilities.find((a) => a.name === 'Breath Weapon');
  expect(breath?.damage?.[0]).toEqual(expect.objectContaining({ dice: 6, dieSize: 6, type: 'fire' }));
  expect(breath?.save).toEqual({ defense: 'reflex', dc: 22, basic: true });
  expect(breath?.isLimitedUse).toBe(true);
});

test('detects primaryDamageIndex when physical damage is not first', () => {
  const doc = npcWithFireFirstClawAttack(); // claw with [fire rider, slashing physical]
  const result = mapFoundryNpcToCreature(doc);
  expect(result.ok && result.value.attacks[0].primaryDamageIndex).toBe(1);
});
```

Add the helper functions or inline JSON fixtures inside the test file.

- [ ] **Step 6: Run mapper tests + full suite + check.**

```
npm run check && npm run test:run
```

- [ ] **Step 7: Commit.**

```
git add src/lib/foundry/types.ts src/lib/foundry/mapper.ts src/lib/foundry/mapper.test.ts
git commit -m "Foundry mapper: extract action damage/save and primary damage index"
```

---

## Task 12: Documentation touches

**Files:**
- Modify: `pf2e-yaml-schema-spec.md`
- Modify: `ROADMAP.md`

Update the canonical specs / roadmap to reflect the v2 schema additions and that the adjustment rework is done.

- [ ] **Step 1: Append a "Schema v2 changes" subsection to `pf2e-yaml-schema-spec.md`.**

```markdown
## Schema v2 — Adjustment-Aware Optional Fields

- `attacks[].primaryDamageIndex?: number` — index of the physical damage component the elite/weak ±2 should target.
- `passiveAbilities[].save?` / `reactiveAbilities[].save?` / `activeAbilities[].save?` — `{ defense: 'fortitude'|'reflex'|'will'; dc: number; basic?: boolean }`. Used by the elite/weak adjustment to scale the DC.
- `*Abilities[].damage?: DamageComponent[]` — structured damage on an offensive ability.
- `*Abilities[].isLimitedUse?: boolean` — when true, the elite/weak rule applies ±4 instead of ±2 to `damage`.
- `spellcasting[].entries[].save?` / `spellcasting[].entries[].damage?` — same purpose for spell entries.

v1 documents remain valid; the importer accepts both `schemaVersion: 1` and `schemaVersion: 2`.
```

- [ ] **Step 2: Mark roadmap item complete with a follow-up.**

In `ROADMAP.md`, under M1 the existing line stays checked. Append under "M4 Persistence and Import" a note:

```markdown
- [x] Creature adjustments redesign: snapshot + derive on read; schemaVersion 2 with structured DC/damage fields. (Spec: docs/superpowers/specs/2026-05-13-creature-adjustments-design.md.)
```

Or, if there's a more apt section, place it there.

- [ ] **Step 3: Commit.**

```
git add pf2e-yaml-schema-spec.md ROADMAP.md
git commit -m "Docs: schema v2 adjustment-aware fields"
```

---

## Task 13: Pre-PR gate

- [ ] **Step 1: Run the full pre-PR pipeline.**

```
npm run check && npm run test:run && npm run audit && npm run build
```

Expected: all four green. If any fails, fix in place and re-run.

- [ ] **Step 2: Smoke-test in the browser once more.**

```
npm run dev
```

Click through: add a creature normal, switch to weak (HP shrinks, current HP clamped), switch to elite (HP grows, AC +4 from weak), open details panel, confirm attack damage and any structured ability DC display with the expected ±2 / ±4.

- [ ] **Step 3: Commit any docs / fixture tidy-ups discovered during smoke test.** Skip if clean.

---

## Task 14: Open the PR

- [ ] **Step 1: Push the branch.**

```
git push -u origin feat/creature-adjustments-redesign
```

- [ ] **Step 2: Open the PR.**

```
gh pr create --title "Creature adjustments: snapshot + derive on read" --body "$(cat <<'EOF'
## Summary
- Replaces bake-at-creation weak/elite with a `baseSnapshot + templateAdjustment` model on `CombatantState`; all adjusted values are derived at read time via `getAdjustedView`.
- Adds optional structured fields (`save`, `damage`, `isLimitedUse`, `primaryDamageIndex`) to `Ability`, `Attack`, and `SpellListEntry` so DCs and damage in abilities and spells scale with the adjustment (±2, or ±4 for limited-use damaging abilities).
- Introduces `SET_TEMPLATE_ADJUSTMENT` command + `template-adjustment-changed` event; toggling clamps `currentHp` to the new max rather than silently healing.
- YAML `schemaVersion: 2` accepted alongside v1; Foundry mapper now extracts action damage, save DCs, spell damage, and detects the primary physical damage index.

Spec: `docs/superpowers/specs/2026-05-13-creature-adjustments-design.md`

## Test plan
- [ ] `npm run check` passes
- [ ] `npm run test:run` passes (full suite)
- [ ] `npm run audit` passes
- [ ] `npm run build` passes
- [ ] Browser smoke: toggle adjustment on a wounded combatant; HP clamps correctly; attack damage and any structured ability DC show the expected ±2 / ±4.
EOF
)"
```

- [ ] **Step 3: Report the PR URL back to the user.**

---

## Self-Review (already performed inline)

- **Spec coverage:** §3 rules → Task 2; §4.1 snapshot model → Tasks 4–5; §4.2 structured fields → Task 1; §4.3 toggle command → Tasks 6–7; §5 data shapes → Task 1; §6 derivation API → Task 2 (all six listed helpers covered); §7 command/event → Task 6; §8 ComputedStats wiring → Task 5 step 9; §9 Foundry mapper → Task 11; §10 schema v2 → Task 10; §11 UI → Tasks 8–9; §12 backwards compatibility → tests in Tasks 5/6 cover party-member rejection and v1 fixtures; §13 test plan → matched by Tasks 2/5/6/10/11.
- **Placeholders:** none; every code-bearing step contains the full code.
- **Type consistency:** `getAdjustedView`, `getEffectiveLevel`, `adjustedDC`, `adjustedHp`, `adjustedDamage`, `adjustedAttack`, `adjustedAbility`, `adjustedSpellBlock`, `adjustedSpellEntry` named consistently across all tasks. `TemplateAdjustment` union (`'normal' | 'elite' | 'weak'`) used consistently. `setTemplateAdjustmentCommand` builder name used in both Task 7 and Task 9.
