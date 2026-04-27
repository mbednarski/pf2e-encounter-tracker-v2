# PF2e Encounter Tracker v2 — Party Members & Companions Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-22
**Status:** Ready for review

---

## 1. Overview

Party members (PCs) and their associated creatures (animal companions, familiars, eidolons) are **persistent entities** that exist across encounters. This is fundamentally different from creatures, which are library templates cloned per encounter and discarded afterward.

Key differences from creatures:

- **Persistent state.** Party members carry effects (afflictions, Wounded, Doomed, curses) between encounters. A curse gained in encounter 1 is still active in encounter 3.
- **Thin statblocks.** The GM doesn't run PCs — they only need defensive stats the GM rolls against and the effect/condition tracking. No attacks, no abilities.
- **Companions are full statblocks.** The GM often runs companions or needs their stats for rulings. They share persistence with their master.
- **Minion initiative rules.** Companions, familiars, and summons act during their master's turn — they don't occupy their own initiative slot.

---

## 2. Amendments to Architecture Spec

### 2.1 CombatantState — Source Tracking

Replace `creatureId` with generalized source tracking:

```typescript
interface CombatantState {
  id: CombatantId
  sourceType: "creature" | "partyMember" | "companion"
  sourceId: string                // creature library ID, party member ID, or companion ID
  name: string                    // display name

  baseStats: CreatureBaseStats    // snapshot at encounter start
  
  currentHp: number
  tempHp: number
  appliedEffects: AppliedEffect[]
  reactionUsedThisRound: boolean
  isAlive: boolean
  notes?: string

  // Minion support
  masterId?: CombatantId          // if set, this combatant is a minion — not in initiative
}
```

`masterId` links a minion to its master combatant within the encounter. Combatants with `masterId` set are excluded from `initiative.order` and processed during their master's turn boundary.

### 2.2 EffectDefinition — Persistence Flag

Add to `EffectDefinition` (arch spec §8.2):

```typescript
interface EffectDefinition {
  // ... existing fields ...
  persistAfterEncounter?: boolean   // default false
}
```

When `true`, instances of this effect on party member / companion combatants are synced back to the persistent record on encounter completion. Built-in conditions that set this flag: `wounded`, `doomed`, and all affliction-category effects. User-imported effects set it per definition.

### 2.3 Turn Flow — Minion Effect Processing

Amend command vocabulary spec §5.1. When END_TURN fires for combatant X:

After step 3 (collect turn-end suggestions from X's effects), add:

> 3a. Collect turn-end suggestions from effects on all combatants where `masterId === X.id`. These prompts are grouped under the minion's name in the UI but resolved in the same RESOLVING phase.

Similarly, when turn-started fires for the next combatant (step 10):

> 10a. Collect turn-start suggestions from effects on all combatants where `masterId === nextCombatant.id`.

Hard clock expirations (steps 2 and 9) also process minion effects anchored to the master's combatant ID.

### 2.4 Encounter Creation — Party Support

There is no EncounterTemplate type (see architecture spec §11.1). The "Add Party" workflow is an orchestrator convenience:

1. GM creates a new encounter
2. GM clicks "Add Party" → orchestrator looks up `Party` → `memberIds`
3. For each member: create combatant, dispatch ADD_COMBATANT
4. For each member's companions: create minion combatant, dispatch ADD_COMBATANT
5. GM adds creatures from the library as needed
6. GM sets initiative, starts encounter

This is multiple ADD_COMBATANT commands. The domain doesn't know about the party concept.

### 2.5 IndexedDB — New Stores

Add to persistence spec (arch spec §13.1):

- **partyMembers** — `PartyMember` records. Keyed by `partyMember.id`.
- **companions** — `Companion` records. Keyed by `companion.id`.
- **parties** — `Party` records. Keyed by `party.id`.

### 2.6 YAML Import/Export — New Types

YAML import/export (arch spec §13.3) covers party members, companions, and parties in addition to creatures, encounters, and effect definitions.

---

## 3. Data Model

### 3.1 PartyMember

```typescript
interface PartyMember {
  id: string
  name: string
  playerName?: string
  level: number
  ancestry?: string
  class?: string

  // Defensive stats — what the GM rolls against
  ac: number
  fortitude: number
  reflex: number
  will: number
  perception: number
  hp: number                          // max HP

  // Optional — populated when useful
  speed?: Record<string, number>
  skills?: Record<string, number>     // subset, GM adds as needed
  resistances?: { type: string; value: number }[]
  weaknesses?: { type: string; value: number }[]
  immunities?: string[]

  // Persistent effects — survive between encounters
  persistentEffects: AppliedEffect[]

  // Associations
  companionIds: string[]              // references Companion records

  // Meta
  notes?: string
  tags: string[]
}
```

**What's missing vs Creature:** No `traits`, `size`, `alignment`, `rarity`, `attacks`, `spellcasting`, `passiveAbilities`, `reactiveAbilities`, `activeAbilities`, `source`. The GM doesn't need these — the player manages their own character sheet. The tracker only needs numbers the GM rolls against and the condition/effect engine.

**Skills:** Optional sparse record. The GM adds specific skills as they come up ("I keep needing Lyra's Athletics for Grab escapes"). `deriveStats()` only processes skills that exist in the record — untracked skills simply don't get condition modifiers displayed. This is fine; the player handles their own skill checks.

### 3.2 Companion

```typescript
interface Companion {
  id: string
  name: string
  type: CompanionType
  masterId: string                    // references PartyMember.id

  // Full statblock — GM needs these
  level: number
  traits?: string[]
  size?: CreatureSize
  ac: number
  fortitude: number
  reflex: number
  will: number
  perception: number
  hp: number
  speed: Record<string, number>
  attacks: Attack[]
  skills?: Record<string, number>
  abilities?: Ability[]
  resistances?: { type: string; value: number }[]
  weaknesses?: { type: string; value: number }[]
  immunities?: string[]

  // Persistent effects
  persistentEffects: AppliedEffect[]

  // Meta
  notes?: string
  tags: string[]
}

type CompanionType =
  | "animal-companion"
  | "familiar"
  | "eidolon"
  | "other"
```

**Why full statblocks:** The GM runs companions or adjudicates their actions. An animal companion's attack rolls, AC, and abilities are referenced constantly during combat. Companions are closer to creatures than to party members in data shape.

**Familiars** have daily-chosen abilities and stats derived from master level. The tracker doesn't model this derivation — the GM enters current stats. The derivation is the player's problem.

**Eidolons** share an HP pool with their Summoner. The tracker doesn't enforce this — the GM tracks it by setting HP to match. The link is informational (via `masterId` → master's HP display nearby in UI).

### 3.3 Party

```typescript
interface Party {
  id: string
  name: string                        // "Extinction Curse Party"
  memberIds: string[]                 // references PartyMember.id
  level: number                       // party level — used by encounter builder
  notes?: string
}
```

Multiple parties from day 1. The encounter builder (future spec) uses `party.level` and `party.memberIds.length` for XP budget calculations.

---

## 4. Encounter Integration

### 4.1 Adding Party Members to an Encounter

Party members and companions are deep-cloned into `CombatantState` like creatures. The encounter state remains self-contained — no live references to persistent records.

**Factory function** (in `domain/creatures/` or a new `domain/party/`):

```typescript
function createCombatantFromPartyMember(
  member: PartyMember
): CombatantState

function createCombatantFromCompanion(
  companion: Companion,
  masterCombatantId: CombatantId
): CombatantState
```

Both functions:

1. Generate a unique `CombatantId`
2. Build `baseStats` from the source's defensive stats
3. Set `currentHp` to source's `hp` (max)
4. Copy `persistentEffects` into `appliedEffects` — these carry into the encounter
5. Set `sourceType` and `sourceId` for sync-back
6. For companions: set `masterId` to the master's combatant ID

**Persistent effects carry forward.** If a party member enters combat with Wounded 2 and an ongoing affliction, those are already in `appliedEffects` when the combatant is created. The effects engine processes them normally — `deriveStats()` applies their modifiers, turn boundary prompts fire as usual.

### 4.2 "Add Party" — Orchestrator Convenience

When the GM selects a party to add to an encounter, the orchestrator:

1. Looks up `Party` → `memberIds`
2. For each `PartyMember`:
   a. Call factory → `CombatantState`
   b. Dispatch `ADD_COMBATANT`
   c. For each active companion (`companionIds`):
      - Call companion factory → `CombatantState` with `masterId`
      - Dispatch `ADD_COMBATANT`

This is multiple commands dispatched in sequence. The domain sees individual ADD_COMBATANT commands — it doesn't know about the party concept.

**"Active" companions:** All companions listed in `partyMember.companionIds` are added by default. The GM can remove unwanted ones during PREPARING phase. A future enhancement could add an `active: boolean` flag on the companion or on the party member's companion reference — not needed for V2. Removing unwanted companions after addition is fast enough.

### 4.3 Initiative Placement

Party members are added to `initiative.order` by the GM via SET_INITIATIVE_ORDER (players roll and report their initiative).

Companions are **not** added to initiative — their `masterId` excludes them. They appear in the UI grouped under their master.

### 4.4 Minions in Combat

Combatants with `masterId` set:

- Are excluded from `initiative.order` — never placed there, rejected if attempted
- Do not have their own turn — no `turn-started` / `turn-ended` events fire for them directly
- Have their effects processed during their master's turn boundary (§2.3 amendment)
- Can be targeted by commands: APPLY_DAMAGE, APPLY_EFFECT, MARK_DEAD, etc. — full combatant participation
- Appear in the UI grouped under their master, with full stat display and effect tracking

**Master dies:** If the master is marked dead, minions remain as combatants but their turn-boundary processing stops (no master turn to trigger it). The GM can still manually manage their effects. If a minion should also die (e.g., eidolon when summoner dies), the GM dispatches MARK_DEAD for the minion.

### 4.5 Sync-Back on Encounter Completion

When COMPLETE_ENCOUNTER is dispatched, the orchestrator runs sync-back:

```
For each combatant where sourceType is "partyMember" or "companion":
  1. Filter appliedEffects to those where:
     - The effect definition has persistAfterEncounter === true, OR
     - effectId is "wounded" or "doomed" (hardcoded safety net), OR
     - parentInstanceId points to an instance that survives this filter
       (implied effects persist alongside their parents)
  2. Transform surviving effects:
     - Clear sourceId and targetId (these are encounter-specific combatant IDs)
     - Clear duration (persistent effects between encounters have no active duration)
     - Keep: effectId, value, note, instanceId
  3. Write to the persistent record's persistentEffects array
     (PartyMember or Companion in IndexedDB)
```

**Implied effects persist alongside parents.** If a party member has Dying (which implies Unconscious), both the Dying and Unconscious instances are persisted. The factory does not re-run implication logic on restore — it copies the full set as-is. This avoids edge cases where implication rules might differ between versions.

**What persists (built-in conditions):**

| Effect | persistAfterEncounter | Rationale |
|---|---|---|
| wounded | true | Carries until full HP rest |
| doomed | true | Carries until full night's rest |
| drained | true | Carries until full night's rest |
| All affliction-category effects | true | Diseases, poisons, curses persist narratively |
| Everything else | false | Combat-only conditions clear when combat ends |

User-imported effects set `persistAfterEncounter` in their definition. The GM controls this.

**Sync-back is orchestrator logic.** The domain's COMPLETE_ENCOUNTER just transitions phase to COMPLETED. The orchestrator reads the final state, extracts persistent effects, and writes to IndexedDB. This keeps the domain pure.

### 4.6 Persistent Effect Shape Between Encounters

Effects stored in `PartyMember.persistentEffects` and `Companion.persistentEffects` use a reduced `AppliedEffect`:

```typescript
interface PersistedEffect {
  instanceId: string
  effectId: string
  value?: number
  note?: string
  parentInstanceId?: string       // preserved — implied effects persist with parents
  // sourceId, targetId, duration — stripped
}
```

When the party member enters a new encounter, the factory expands these back into full `AppliedEffect` instances:

- `sourceId` → set to the combatant's own ID (source is "the previous encounter" — no better attribution available)
- `targetId` → set to the combatant's own ID
- `duration` → `{ type: "unlimited" }` (persisted effects have no encounter-scoped duration)
- `parentInstanceId` → preserved from `PersistedEffect` (maintains implied effect chains)

---

## 5. Summons

Summons are **not persistent**. They are creatures from the creature library, added mid-combat via ADD_COMBATANT and removed when the spell ends.

No new data type. The workflow:

1. GM picks creature from library (or imports one)
2. Dispatches ADD_COMBATANT with `sourceType: "creature"` and `masterId` set to the summoner's combatant ID
3. The summon is a minion — processed during the summoner's turn
4. When the spell ends, GM dispatches REMOVE_COMBATANT or MARK_DEAD

The only difference from a regular creature combatant is the `masterId` field. No sync-back, no persistence.

---

## 6. CreatureBaseStats — Unified Shape

Both creatures and party members need to produce a `CreatureBaseStats` for the combatant snapshot. This type is the common denominator used by `deriveStats()`:

```typescript
interface CreatureBaseStats {
  ac: number
  fortitude: number
  reflex: number
  will: number
  perception: number
  hp: number
  skills: Record<string, number>      // may be empty or partial
  speed?: Record<string, number>
  resistances?: { type: string; value: number }[]
  weaknesses?: { type: string; value: number }[]
  immunities?: string[]
}
```

For creatures: populated from the full `Creature` statblock (including weak/elite adjustment).

For party members: populated from `PartyMember` fields directly. `skills` is the optional sparse record — only tracked skills appear.

For companions: populated from `Companion` fields. Full skill list if available.

`deriveStats()` doesn't care where the base stats came from. It applies modifiers to whatever stats exist. If a party member has no skills in the record, condition modifiers that target skills simply produce no output for that member — the derivation is still correct, just incomplete.

---

## 7. New Commands

### 7.1 Party & Member Management Commands

These operate on persistent records, not encounter state. They are dispatched outside of encounters (or during PREPARING) and write directly to IndexedDB via the orchestrator. They do NOT go through the domain's `applyCommand` — they are persistence-layer operations.

**Rationale:** The domain's `applyCommand` is an encounter state machine. Party member CRUD is not an encounter state transition — it's library management, same category as creature library operations. The orchestrator handles these directly.

```typescript
// Party CRUD
type PartyCommand =
  | { type: "CREATE_PARTY"; payload: { party: Party } }
  | { type: "UPDATE_PARTY"; payload: { partyId: string; updates: Partial<Party> } }
  | { type: "DELETE_PARTY"; payload: { partyId: string } }

// PartyMember CRUD
type PartyMemberCommand =
  | { type: "CREATE_PARTY_MEMBER"; payload: { member: PartyMember; partyId: string } }
  | { type: "UPDATE_PARTY_MEMBER"; payload: { memberId: string; updates: Partial<PartyMember> } }
  | { type: "DELETE_PARTY_MEMBER"; payload: { memberId: string } }

// Companion CRUD
type CompanionCommand =
  | { type: "CREATE_COMPANION"; payload: { companion: Companion } }
  | { type: "UPDATE_COMPANION"; payload: { companionId: string; updates: Partial<Companion> } }
  | { type: "DELETE_COMPANION"; payload: { companionId: string } }
```

These are not undo-able via the encounter undo stack (they aren't encounter commands). Destructive operations (delete) get a confirmation dialog in the UI.

### 7.2 Encounter Commands — No Changes

No new encounter commands needed. Party members and companions enter encounters through existing ADD_COMBATANT. The "Add Party" workflow is orchestrator sugar that dispatches multiple ADD_COMBATANT commands.

REMOVE_COMBATANT, APPLY_DAMAGE, APPLY_EFFECT, etc. all work identically regardless of `sourceType`. The domain doesn't distinguish between creature combatants and party member combatants.

---

## 8. Validation Rules

### 8.1 Party

- `name` required, non-empty
- `memberIds` — all must reference existing `PartyMember` records
- `level` must be >= 1

### 8.2 PartyMember

- `name` required, non-empty
- `ac`, `fortitude`, `reflex`, `will`, `perception`, `hp` — required, >= 0
- `level` must be >= 1
- `companionIds` — all must reference existing `Companion` records
- `persistentEffects` — each must reference a valid effect in the library

### 8.3 Companion

- `name` required, non-empty
- `masterId` must reference an existing `PartyMember`
- `type` must be a valid `CompanionType`
- Same stat validations as PartyMember
- `attacks` — validated same as creature attacks

### 8.4 Minion in Encounter

- A combatant with `masterId` must reference an existing combatant in the same encounter
- A combatant with `masterId` cannot be placed in `initiative.order` — SET_INITIATIVE_ORDER and REORDER_COMBATANT reject minion IDs
- DELAY and RESUME_FROM_DELAY reject minion IDs — minions can't delay independently

---

## 9. Edge Cases

### 9.1 Master Removed Mid-Combat

If REMOVE_COMBATANT is dispatched for a master, its minions are also removed. Cascade rule: removing a combatant removes all combatants where `masterId` matches.

If MARK_DEAD is dispatched for a master, minions are NOT auto-killed. The GM decides (an animal companion might flee, an eidolon might de-manifest, a summon might persist until the spell's duration ends).

### 9.2 Companion Without Master in Encounter

A companion can exist in the encounter without its master (edge case: master is narratively absent but companion is present). In this case, `masterId` on the combatant is `undefined` and the companion IS placed in initiative — it acts independently. The GM manages this manually.

### 9.3 Multiple Companions

A party member can have multiple companions (e.g., Beastmaster archetype). All are added as separate minion combatants under the same master. Their effects are all processed during the master's turn boundary — prompts are generated for each and grouped by minion name.

### 9.4 Persistent Effect Conflict

A party member enters an encounter with Wounded 2 (persisted). During the encounter, they recover from Dying → Wounded increments to 3. This works naturally — the persisted Wounded is just an AppliedEffect in the combatant's array. MODIFY_EFFECT_VALUE increments it. On sync-back, the updated value (3) is written back.

### 9.5 Party Member Level-Up Between Encounters

The GM updates `PartyMember` stats via UPDATE_PARTY_MEMBER. This is a persistent record change — no encounter is running. Next encounter, the combatant is cloned from the updated stats.

If a level-up happens mid-campaign-session between encounters, the GM just edits the numbers. No automated derivation — the player tells the GM their new AC/saves/perception.

### 9.6 Same Party in Multiple Encounters (Sequential)

Normal flow: encounter 1 completes → sync-back → encounter 2 setup → party added → persistent effects carry forward.

Sync-back must complete before the next encounter can pull party data. The orchestrator enforces ordering: sync-back is async but blocks encounter creation from the same party until complete.

---

## 10. Summary — What's New

### 10.1 New Types

| Type | Location | Purpose |
|---|---|---|
| `PartyMember` | `domain/types/party.ts` | Persistent PC record |
| `Companion` | `domain/types/party.ts` | Persistent companion/familiar/eidolon |
| `Party` | `domain/types/party.ts` | Named group of party members |
| `CompanionType` | `domain/types/party.ts` | Union type for companion categories |
| `PersistedEffect` | `domain/types/effect.ts` | Reduced effect shape for between-encounter storage |

### 10.2 Modified Types

| Type | Change |
|---|---|
| `CombatantState` | Replace `creatureId` with `sourceType` + `sourceId`. Add `masterId?`. |
| `EffectDefinition` | Add `persistAfterEncounter?: boolean`. |

### 10.3 New IndexedDB Stores

`partyMembers`, `companions`, `parties`.

### 10.4 New Orchestrator Logic

- Party member / companion factory functions
- "Add Party" convenience dispatch
- Sync-back on encounter completion
- Minion cascade on master removal

### 10.5 Modified Domain Logic

- Turn boundary processing includes minions of the current combatant
- REMOVE_COMBATANT cascades to minions
- SET_INITIATIVE_ORDER / REORDER_COMBATANT / DELAY / RESUME_FROM_DELAY reject minion combatant IDs
- Hard clock expirations process minion effects anchored to master

### 10.6 Built-in Effects — persistAfterEncounter Flag

| Effect | Flag |
|---|---|
| `wounded` | `true` |
| `doomed` | `true` |
| `drained` | `true` |
| All `category: "affliction"` | `true` |
| Everything else | `false` (default) |