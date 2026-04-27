# PF2e Encounter Tracker v2 — Afflictions Subsystem Specification

**Version:** 0.1 (draft)
**Date:** 2026-04-25
**Status:** Ready for review
**Builds on:** Effects & durations spec, Conditions library spec, LLM parser spec §11

---

## 1. Purpose & Scope

This spec defines how PF2e afflictions (poisons, diseases, curses) are modeled in V2. It locks in the architectural decision (reminder-only, not full stage automation), specifies the `AfflictionData` type, documents the runtime behavior, and explicitly defers stage-effect automation to a future enhancement.

**In scope:** Affliction data model, save prompt generation, stage display, onset/duration/maxDuration handling, virulent trait support, UI rendering contract.

**Out of scope:** Automatic application of stage effects (Drained 2 when stage 3 hits — GM does this manually via APPLY_EFFECT). Immunity tracking after recovery. Affliction creation UI. Affliction interaction with poison-bypass abilities.

---

## 2. The Decision: Reminder-Only Tracking

V2 implements afflictions as **regular `EffectDefinition`s** with an attached `AfflictionData` block carrying stage data, save info, and timing metadata. The system tracks:

- Current stage (as `AppliedEffect.value`)
- Save prompt generation at the documented interval
- Stage description display

The system does NOT track:

- Per-stage effect synchronization. When stage advances from 2 to 3, the system does not apply the new stage's modifiers automatically. The GM reads the stage description and dispatches APPLY_EFFECT for any required conditions (Drained 2, Weakness 5 to fire, etc.).
- Onset timer. The GM applies the affliction when onset elapses; the system shows onset as advisory metadata.
- Recovery immunity. Out of scope.

### 2.1 Why Reminder-Only

This decision is consistent with arch decision A4 ("GM authority — suggest, never auto-apply"). Full stage tracking would require either:

- Auto-applying per-stage effects (violates A4)
- A hybrid with prompts at every stage transition (multiplies prompt fatigue — afflictions can prompt every turn already)

Stage effects in PF2e are extremely heterogeneous: status conditions, weakness, ability damage, area effects, action restrictions, custom rules text. Modeling them as a uniform automation target is a large design effort with low payoff at the table — the GM reads the description and dispatches the right condition in seconds.

The data model already supports reminder-only tracking. This spec just makes it canonical.

### 2.2 Future Enhancement Path

The data captured here (`stages`, `description` text per stage) is sufficient to support a future "Apply stage effects" button: when stage advances, the UI surfaces detected condition references in the description as one-tap APPLY_EFFECT commands. This would be a UX improvement on top of identical data — no model changes needed.

---

## 3. AfflictionData Type

Add to the effects subsystem (effects-and-durations spec §2). New optional field on `EffectDefinition`:

```typescript
interface EffectDefinition {
  // ... existing fields ...
  afflictionData?: AfflictionData    // present iff category === "affliction"
}

interface AfflictionData {
  saveType: "fortitude" | "reflex" | "will"
  saveDC: number
  onset?: string                     // free text: "1 round", "1d4 hours" — advisory only
  interval: string                   // "1 round", "1 day"
  maxDuration?: string               // "6 rounds" — advisory only when not modeled in Duration
  stages: AfflictionStage[]
  virulent?: boolean                 // true if affliction has the virulent trait
}

interface AfflictionStage {
  stage: number                      // 1-indexed
  description: string                // full stage effect text — verbatim from source
}
```

### 3.1 Field Notes

- **`saveType` and `saveDC`** drive prompt generation. Used by the prompt generator to construct the save prompt's description string.
- **`onset`** is advisory text. The GM applies the affliction when onset elapses; no automatic activation. Display this prominently when the affliction is first applied.
- **`interval`** indicates how often saves are rolled. For combat afflictions ("1 round"), the system fires a save prompt at the carrier's turn end. For longer intervals ("1 day"), the GM handles between encounters.
- **`maxDuration`** is advisory text shown to the GM. If the GM wants automatic enforcement, they pair the affliction with a `Duration: { type: "rounds", count: N }` — but this is GM choice at apply time, not auto-set.
- **`stages`** is 1-indexed (matching `AppliedEffect.value`). Stage 0 means "no current effect" (during onset or after recovery — but recovery removes the effect entirely, so stage 0 is rarely materialized).
- **`virulent`** flips the save-outcome arithmetic; see §5.2.

### 3.2 Validity Constraint

If `category === "affliction"`, `afflictionData` must be present. If `category !== "affliction"`, `afflictionData` should be undefined. The validator (LLM parser spec §6) enforces this on import.

---

## 4. Application Flow

### 4.1 Initial Application

When the GM applies an affliction (e.g., creature is bitten by a giant centipede):

1. GM dispatches `APPLY_EFFECT` with:
   - `effectId: "giant-centipede-venom"` (or whatever the affliction's ID is)
   - `value: 1` (starting stage 1, or higher if the source rules say so)
   - `duration`: typically `{ type: "rounds", count: N }` if maxDuration is "N rounds", else `{ type: "unlimited" }`
   - `note?`: optional GM annotation
2. The standard APPLY_EFFECT pipeline runs (effects-and-durations spec §6.4 — implied effects, source freezing, etc.).
3. UI displays the effect with stage description visible.

### 4.2 Onset

If the affliction has an `onset`, the GM has two choices:

**(a)** Wait — don't apply the affliction until onset elapses. Track mentally or via SET_NOTE on the carrier.

**(b)** Apply immediately with a GM annotation note ("onset 1 round") and skip the first save prompt. The UI displays onset metadata so the prompt generator can be told to suppress saves until after onset.

Default behavior: **(a)** — the GM applies when active. The system has no special onset state. This keeps the data model simple and matches the principle that the GM controls timing.

**No change to commands or events for onset.** It's purely a display affordance.

---

## 5. Save Prompt Generation

### 5.1 Trigger

For afflictions with `interval: "1 round"`, a save prompt fires at the affected combatant's turn end. This is implemented via the existing `turnEndSuggestion` mechanism (effects-and-durations spec §5):

```typescript
// Loaded into EffectDefinition by the LLM parser / YAML import:
{
  id: "giant-centipede-venom",
  category: "affliction",
  afflictionData: { /* ... */ },
  turnEndSuggestion: {
    type: "promptResolution",
    description: "{saveType} save DC {saveDC}. ..."
  }
}
```

The prompt generator (called at turn-end resolution) reads `afflictionData` to fill template variables:

- `{saveType}` → "Fortitude", "Reflex", or "Will" (capitalized)
- `{saveDC}` → numeric DC

The resulting prompt is just a regular `Prompt` of type `promptResolution`, indistinguishable structurally from any other prompt.

### 5.2 Save Outcome — Standard vs Virulent

The prompt's description text varies based on whether the affliction is virulent:

**Standard (virulent: false or undefined):**
```
{saveType} save DC {saveDC}.
Crit Success → reduce by 2.
Success → reduce by 1.
Failure → increase by 1.
Crit Failure → increase by 2.
```

**Virulent (virulent: true):**
```
{saveType} save DC {saveDC} (virulent).
Crit Success → reduce by 1.
Success → no change.
Failure → increase by 1.
Crit Failure → increase by 2.
```

The LLM parser is responsible for setting `virulent: true` when it detects the virulent trait on the affliction (typically in traits or in the description). The parser fills the description string accordingly, OR the prompt generator can reconstruct the description from the boolean flag. Either approach works — recommend the parser fills the string verbatim and the boolean is for UI rendering.

### 5.3 GM Resolution

The GM rolls the save offline, then dispatches:

- Crit Success: `MODIFY_EFFECT_VALUE` with delta -2 (or -1 for virulent)
- Success: `MODIFY_EFFECT_VALUE` with delta -1 (or 0 / dismiss for virulent)
- Failure: `MODIFY_EFFECT_VALUE` with delta +1
- Crit Failure: `MODIFY_EFFECT_VALUE` with delta +2

If the modify takes value to 0 or below, the affliction is auto-removed (per effects-and-durations spec §6.1). This is the recovery path.

If the modify takes value above the highest-defined stage, the value clamps at the max in display only (UI shows "Stage N" as the highest defined). The underlying value can technically exceed maxValue per the effects-spec §6.1 rule. In practice MODIFY_EFFECT_VALUE +2 from max stage should not exceed by more than 2; UI shows max stage's description regardless.

### 5.4 Structured Resolution UI (Future / Optional)

Because the four-outcome pattern is universal across afflictions, the UI can detect `Prompt.effectInstanceId` resolves to an effect with `category === "affliction"` and render four buttons (Crit Success / Success / Failure / Crit Failure) instead of free-text resolution. Each button auto-dispatches the correct MODIFY_EFFECT_VALUE delta based on `afflictionData.virulent`.

This is a UI optimization. The data model does not require it. Both the loose prompt resolution UI and the structured affliction resolution UI work against the same domain commands.

---

## 6. Stage Display

### 6.1 At a Glance

In the combatant's effect list, an applied affliction renders as:

```
Giant Centipede Venom (Stage 2)
> Sickened 1 and weakness 5 to bludgeoning
```

Where:
- Top line: effect name + current stage (from `AppliedEffect.value`)
- Below: `afflictionData.stages[value - 1].description`

If stage 0 (rare): show "(onset)" or "(recovered)" status.
If value > max defined stage: show description from highest-defined stage.

### 6.2 Expanded View

When expanded, additional metadata displays:

- Save: "Fortitude DC 18" (and "(virulent)" if applicable)
- Interval: "1 round" (or whatever interval is)
- Onset: "1 round" if defined (with note that GM should track timing)
- Max duration: "6 rounds" if defined (and if a Duration was set, show remaining rounds)
- All stage descriptions (current stage highlighted)

This is reference material the GM can scan during play.

---

## 7. Domain Behavior — No New Commands

Afflictions do NOT introduce new commands. Existing commands cover all interactions:

| Action | Command |
|---|---|
| Apply affliction (creature bitten, etc.) | APPLY_EFFECT |
| Stage advances on failed save | MODIFY_EFFECT_VALUE (+1 or +2) |
| Stage decreases on successful save | MODIFY_EFFECT_VALUE (-1 or -2) |
| Affliction recovered | MODIFY_EFFECT_VALUE that hits ≤ 0 → auto-removal |
| GM forced override (homebrew, narrative) | SET_EFFECT_VALUE |
| Affliction removed by external effect (Neutralize Poison) | REMOVE_EFFECT |
| Affliction expires from maxDuration rounds counter | SET_EFFECT_DURATION + MODIFY_EFFECT_VALUE / REMOVE_EFFECT (GM-driven) |
| Apply per-stage condition (Drained 2 at stage 3) | APPLY_EFFECT (separate effect) — GM-dispatched |

No new domain events either. All affliction state changes flow through existing event types from the domain events spec.

---

## 8. Persistence

Afflictions have `persistAfterEncounter: true` (effects-and-durations spec §2). On encounter completion, affliction instances on party member / companion combatants are synced back to the persistent record (party spec §4.5).

The full `AppliedEffect` instance is preserved — including current stage value. When the carrier enters a new encounter, the affliction is re-hydrated at the same stage.

For the inter-encounter time, the GM is responsible for narrative resolution. If "1 day" passes between sessions and the affliction has interval 1 day, the GM dispatches MODIFY_EFFECT_VALUE for each save the carrier attempts during that interval. There is no automatic between-session save.

---

## 9. Examples

### 9.1 Giant Centipede Venom (Combat Poison, Standard)

YAML:

```yaml
id: giant-centipede-venom
name: Giant Centipede Venom
category: affliction
hasValue: true
maxValue: 2
modifiers: []
persistAfterEncounter: true
afflictionData:
  saveType: fortitude
  saveDC: 14
  interval: "1 round"
  maxDuration: "4 rounds"
  stages:
    - stage: 1
      description: "1d6 poison damage and clumsy 1"
    - stage: 2
      description: "1d6 poison damage and clumsy 2"
turnEndSuggestion:
  type: promptResolution
  description: >-
    Fortitude save DC 14.
    Crit Success → reduce by 2.
    Success → reduce by 1.
    Failure → increase by 1.
    Crit Failure → increase by 2.
```

Runtime flow:
1. GM dispatches APPLY_EFFECT with effectId `giant-centipede-venom`, value 1, duration `{ type: "rounds", count: 4 }`. Stage 1 description displays.
2. GM applies Clumsy 1 manually via APPLY_EFFECT, and rolls 1d6 poison damage applied via APPLY_DAMAGE.
3. At carrier's turn end, save prompt fires. GM rolls — fails. Dispatches MODIFY_EFFECT_VALUE delta +1. Stage advances to 2. Description updates to "1d6 poison damage and clumsy 2".
4. GM dispatches MODIFY_EFFECT_VALUE on the existing Clumsy effect to bring it to 2, rolls 1d6 poison damage.
5. Process repeats. On next save, GM rolls success. Dispatches MODIFY_EFFECT_VALUE delta -1. Stage drops to 1. Eventually reaches 0 and the affliction auto-removes. GM removes Clumsy (or lets it expire on its own if it had its own duration).

### 9.2 Spider Venom (Virulent)

YAML:

```yaml
id: hunting-spider-venom
name: Hunting Spider Venom
category: affliction
hasValue: true
maxValue: 4
modifiers: []
persistAfterEncounter: true
afflictionData:
  saveType: fortitude
  saveDC: 19
  interval: "1 round"
  maxDuration: "4 rounds"
  virulent: true
  stages:
    - stage: 1
      description: "1d6 poison damage"
    - stage: 2
      description: "1d6 poison damage and clumsy 2"
    - stage: 3
      description: "2d6 poison damage and clumsy 2"
turnEndSuggestion:
  type: promptResolution
  description: >-
    Fortitude save DC 19 (virulent).
    Crit Success → reduce by 1.
    Success → no change.
    Failure → increase by 1.
    Crit Failure → increase by 2.
```

Same flow as 9.1, but the GM uses the virulent prompt arithmetic. The structured resolution UI (if implemented) reads `virulent: true` and dispatches MODIFY_EFFECT_VALUE deltas of -1/0/+1/+2 instead of -2/-1/+1/+2.

### 9.3 Slow Disease (Long Interval)

YAML:

```yaml
id: filth-fever
name: Filth Fever
category: affliction
hasValue: true
maxValue: 3
modifiers: []
persistAfterEncounter: true
afflictionData:
  saveType: fortitude
  saveDC: 17
  onset: "1d4 hours"
  interval: "1 day"
  stages:
    - stage: 1
      description: "carrier"
    - stage: 2
      description: "fatigued"
    - stage: 3
      description: "fatigued and enfeebled 1"
# No turnEndSuggestion — interval is too long for combat prompts.
```

Note: no `turnEndSuggestion`. Interval is 1 day, not 1 round, so no in-combat prompts fire. The affliction persists in the carrier's record. The GM dispatches MODIFY_EFFECT_VALUE between sessions or during downtime as appropriate. The stage description still displays during play so the GM remembers the carrier is fatigued.

---

## 10. Validator Amendments (LLM Parser Spec §6)

Add validation rules for affliction definitions:

| Rule | Severity |
|---|---|
| `category: "affliction"` requires `afflictionData` field | error |
| `afflictionData.saveType` ∈ {fortitude, reflex, will} | error |
| `afflictionData.saveDC` is integer ≥ 0 | error |
| `afflictionData.interval` is non-empty string | error |
| `afflictionData.stages` non-empty, each has `stage: integer` and `description: string` | error |
| `afflictionData.stages[i].stage` values 1, 2, 3, ... contiguous | warning |
| `maxValue` matches `stages.length` | warning, auto-correct |
| Affliction with `interval: "1 round"` should have `turnEndSuggestion` | warning |
| `persistAfterEncounter: true` for category affliction | warning, auto-correct (set to true) |
| `virulent: true` should be reflected in `turnEndSuggestion.description` | warning (the parser handles this; the validator just verifies consistency) |

---

## 11. UI Display Notes (Brief)

This is not a UI spec, but the affliction data model implies:

- **Stage description prominent** in compact effect display (single line under name).
- **Save metadata** (save type, DC, virulent badge) visible in expanded view.
- **Onset** as a one-time toast when the affliction is first applied: "Onset 1 round — apply effects after that time."
- **Max duration** as a small countdown badge if a `Duration: rounds` was set.
- **Save prompt** rendered with structured 4-button resolution (per §5.4 — optional optimization).

The combat log formatter renders affliction events using the existing event types. A stage advance fires `effect-value-changed` — the formatter can identify it as an affliction (via category lookup) and render "Goblin's Giant Centipede Venom advanced to stage 2".

---

## 12. Out of Scope for V2

| Feature | Reason / Future path |
|---|---|
| Auto-application of stage effects | GM-dispatched. Future: stage-effect parsing → "Apply" button. |
| Onset timer automation | GM-tracked. Future: explicit onset state machine. |
| Recovery immunity (1-day immunity after recovery) | GM-tracked via SET_NOTE. |
| Affliction interaction with poison-bypass abilities | GM rules. |
| Multi-affliction stacking rules (PF2e limits stages of related afflictions) | GM enforces. |
| Affliction-specific commands (`ADVANCE_AFFLICTION`, `RESOLVE_AFFLICTION_SAVE`) | Existing commands cover all cases. Adding specialized commands would just be sugar. |
| Custom save mechanics (e.g., saves with bonus from a specific source) | The save DC is fixed in `AfflictionData`. Per-roll modifiers are GM-tracked. |

---

## 13. Test Priority

1. **Stage display** — Affliction at value 2 displays `stages[1].description`. Value 5 with maxValue 3 displays `stages[2].description` (highest defined).
2. **Save prompt generation** — Affliction with `interval: "1 round"` and `turnEndSuggestion` produces a prompt at the carrier's turn end. Other intervals produce no prompts.
3. **MODIFY_EFFECT_VALUE recovery** — From stage 1, MODIFY -1 brings to 0, effect auto-removes via existing rule.
4. **maxValue overflow** — From stage 3 (max), MODIFY +2 brings value to 5. Effect persists. UI displays stage 3 description (clamp).
5. **Persistence round-trip** — Apply affliction at stage 2 to a party member, complete encounter. Re-add to a new encounter. Affliction is re-hydrated at stage 2.
6. **Virulent flag** — Effect with `afflictionData.virulent: true` has prompt description matching virulent template. Standard affliction matches standard template.
7. **No `afflictionData` on non-affliction** — Validator rejects an EffectDefinition with `category: "spell"` and `afflictionData` set. Conversely, `category: "affliction"` without `afflictionData` is rejected.
8. **No new commands** — Verify all affliction state changes flow through the existing command vocabulary. No new event types. No new prompt subtypes.

---

## 14. Amendments to Existing Specs

### 14.1 Effects-and-Durations Spec §2

Add `afflictionData?: AfflictionData` to `EffectDefinition`. Add type definitions for `AfflictionData` and `AfflictionStage`.

### 14.2 LLM Parser Spec §11

The "Affliction Schema" section already aligns with this spec. Add the validator rules from §10 above.

### 14.3 Conditions Library Spec

No changes — afflictions live in user-imported library, not the built-in conditions library. The built-in conditions library does not contain afflictions.

### 14.4 Architecture Spec §19.2

Replace "Afflictions subsystem: Decision on whether V2 supports full stage progression or models afflictions as reminder-only" with a reference to this spec. Decision is locked: reminder-only.

### 14.5 Domain Events Spec

No new events. Existing event types cover affliction state changes.

### 14.6 Command Vocabulary Spec

No new commands. Existing commands cover all affliction interactions.

---

## 15. Open Items

None. This spec closes the affliction question for V2.

---

## 16. Update Project Instructions

Add to "Remaining Specification Topics" as completed:

- [x] **Afflictions subsystem** — Decision: reminder-only stage tracking. AfflictionData type, save prompt generation, stage display, virulent support. Existing commands and events cover all behaviors.

This unblocks the LLM parser for creature parsing — the parser's existing affliction YAML output is fully consistent with the data model.