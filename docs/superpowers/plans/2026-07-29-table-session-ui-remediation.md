# Table-Session UI Remediation Implementation Plan

> **Status:** Completed on 2026-07-29.
>
> **Fresh-session entry point:** Start with the pre-flight section, then implement tasks in order. Do not re-audit the whole product before Task 1; the evidence and decisions needed for this work are recorded here.

**Goal:** Make the encounter tracker safe, complete, efficient, and clear for a GM running Pathfinder 2e at a physical table, with tablets as the primary usage context.

**Architecture:** Preserve the pure TypeScript domain and static, browser-only deployment. Remove automated Delay/Resume semantics completely. Add encounter safety and lifecycle controls before ergonomic improvements. Keep all persistence local in IndexedDB and do not add server-side services.

**Primary references:**

- `pf2e-tracker-v2-architecture-spec.md`
- `pf2e-command-vocabulary-spec.md`
- `pf2e-domain-events-spec.md`
- `pf2e-party-members-spec.md`
- `pf2e-yaml-schema-spec.md`
- `ROADMAP.md`

## Completion record

All eleven tasks and the final validation gate were completed on
`codex/table-session-ui-remediation`.

- Svelte/TypeScript: zero diagnostics.
- Vitest: 81 files passed; 1,133 tests passed and 1 skipped.
- Playwright: nine workflows passed across 1440×900 desktop, 1024×768 touch,
  and 768×1024 touch projects.
- Dependency audit: zero known vulnerabilities at moderate severity or higher.
- Static production build and `git diff --check`: passed.

The checklist below is retained as the approved implementation inventory; the
completion status and current release criteria are canonical here and in
`ROADMAP.md`.

---

## Locked decisions

1. **Delay and Resume from Delay are not automated.**
   - Remove them from canonical specs, domain types, reducer behavior, events, log formatting, and tests.
   - A GM who needs Delay handles it manually by changing the initiative order.
   - The tracker does not infer turn-boundary effects or timing consequences for Delay.

2. **PF2e rule text mentioning Delay remains.**
   - Condition descriptions such as “can’t Delay” describe the tabletop rule and are not tracker feature promises.
   - Do not remove those descriptions from the conditions library.

3. **Encounter safety precedes convenience work.**
   - A live encounter must not be erasable with one tap.
   - The lifecycle must distinguish completing, preparing a rematch, and discarding an encounter.

4. **Long-press is an optional accelerator, never the only route to an operation.**

5. **Tablet controls use real hit areas.**
   - Frequent actions should have at least a 44 by 44 CSS-pixel target.
   - Avoid overlapping pseudo-element hit areas for adjacent controls.

6. **No new backend architecture.**
   - Remain deployable as a static Cloudflare Pages application.

---

## Audit baseline

The live audit exercised:

- 1440×900 desktop;
- 1024×768 landscape tablet;
- 768×1024 portrait tablet;
- encounter setup and initiative rolling;
- five points of damage through HP delta input;
- Frightened 2 and derived-stat changes;
- blocking end-of-turn prompt resolution;
- turn advancement;
- library and details drawers;
- IndexedDB recovery after reload.

Baseline validation at plan creation:

- `npm run check`: passed with zero diagnostics.
- `npm run test:run`: 78 files passed; 1,153 tests passed and 1 skipped.
- No runtime browser warnings appeared during the exercised flow.

Do not treat these numbers as permanent assertions. Record the current baseline again before implementation.

---

## Pre-flight

- [ ] Confirm the current branch and worktree:

  ```powershell
  git branch --show-current
  git status --short
  ```

- [ ] Preserve unrelated user changes. At plan creation, `.claude/launch.json` was an unrelated untracked file.

- [ ] Create or switch to a scoped branch, using the repository’s normal `codex/` prefix unless the user specifies otherwise.

- [ ] Run the baseline:

  ```powershell
  npm run check
  npm run test:run
  ```

- [ ] Record any baseline failure before changing code.

---

## Task 1: Remove automated Delay and Resume from Delay

**Purpose:** Remove a rejected automation concept completely rather than leaving dead or misleading domain behavior.

**Specs and tracking:**

- Modify `pf2e-tracker-v2-architecture-spec.md`
- Modify `pf2e-command-vocabulary-spec.md`
- Modify `pf2e-domain-events-spec.md`
- Modify `pf2e-party-members-spec.md`
- Modify `ROADMAP.md`

**Runtime and tests:**

- Modify `src/domain/types.ts`
- Modify `src/domain/reducer.ts`
- Modify `src/domain/reducer.test.ts`
- Modify `src/domain/test-support.ts`
- Modify `src/domain/encounter-xp.test.ts`
- Modify `src/lib/encounter-app.ts`
- Modify `src/lib/combat-log/format.ts`
- Modify `src/lib/combat-log/format.test.ts`
- Modify `src/lib/storage/active-encounter.ts`
- Modify `src/lib/storage/active-encounter.test.ts`
- Update any additional compiler-identified fixtures.

### Steps

- [ ] Remove `delaying` from `InitiativeState`.
- [ ] Remove `DELAY` and `RESUME_FROM_DELAY` from command unions and command types.
- [ ] Remove `combatant-delayed` and `combatant-resumed-from-delay` from domain events.
- [ ] Remove reducer phase allowances, switch branches, helper functions, and delayed-combatant cleanup.
- [ ] Remove the dedicated reducer and log-formatting tests.
- [ ] Remove `delaying: []` from constructors and test fixtures.
- [ ] Update initiative command totals and phase tables in the canonical specs.
- [ ] Replace the roadmap’s completed Delay/Resume item with:

  > Delay is intentionally manual. The GM represents it by reordering initiative; the tracker does not automate its timing or effect-boundary semantics.

- [ ] Retain ordinary PF2e text such as “Can’t Delay” in condition descriptions.

### Legacy persistence migration

`loadActiveEncounter` currently casts stored state directly to `EncounterState`. Add a narrow migration before returning:

- [ ] Detect a legacy `initiative.delaying` array.
- [ ] If empty, discard it.
- [ ] If non-empty:
  - keep only IDs that still exist in `combatants`;
  - exclude IDs already present in `initiative.order`;
  - append the remaining IDs to the end of `initiative.order`;
  - discard `delaying`;
  - return migration metadata or another narrow signal so the route can add a warning:

    > A legacy encounter contained delayed combatants. They were restored at the end of initiative; reorder them manually.

- [ ] Do not attempt to infer a correct resume position.

### Verification

- [ ] Run:

  ```powershell
  rg -n "DELAY|RESUME_FROM_DELAY|delaying|combatant-delayed|combatant-resumed-from-delay" `
    -g "!node_modules" -g "!build" -g "!static/spell-index.json" .
  ```

- [ ] Remaining hits may only be:
  - PF2e rules descriptions;
  - explicit legacy migration names/tests;
  - the roadmap decision note explaining manual handling.

- [ ] Run:

  ```powershell
  npm run check
  npm run test:run
  ```

**Acceptance:** No public domain command, state field, event, or UI promise for automated Delay remains. Legacy saves cannot silently lose combatants.

---

## Task 2: Make encounter destruction safe

**Purpose:** Eliminate the highest-risk table-session failure: erasing a live encounter with one tap.

**Files:**

- Modify `src/components/SetupPanel.svelte`
- Modify `src/components/SetupPanel.test.ts`
- Modify `src/routes/+page.svelte`
- Modify `src/routes/layout.test.ts` or add a focused route test if appropriate
- Reuse `src/components/ui/Modal.svelte`

### Steps

- [ ] Rename `Reset Local` to `Discard Encounter…`.
- [ ] Replace immediate reset with an in-app confirmation modal.
- [ ] Explain that the active encounter and combat log will be removed while creature, hazard, and party libraries remain.
- [ ] Use:
  - `Keep Encounter` as the safe/default action;
  - `Discard Encounter` as the destructive action.
- [ ] Disable repeat submission while clearing persistence.
- [ ] Keep the current encounter intact if the modal is cancelled or closed with Escape.
- [ ] Surface a failure notice if IndexedDB clearing fails.

### Verification

- [ ] Component test: opening and cancelling does not call reset.
- [ ] Component/route test: confirming resets state and clears active persistence.
- [ ] Browser smoke test during `ACTIVE`: one tap never erases the encounter.

**Acceptance:** An active encounter cannot be destroyed without a clearly labelled confirmation step.

---

## Task 3: Complete the encounter lifecycle

**Purpose:** Provide distinct, understandable flows for finishing combat, preparing a rematch, and starting over.

**Files:**

- Modify `src/components/EncounterHeader.svelte`
- Modify `src/components/EncounterHeader.test.ts`
- Modify `src/components/SetupPanel.svelte`
- Modify `src/routes/+page.svelte`
- Modify route/component tests as needed
- Reuse existing `COMPLETE_ENCOUNTER` and `RESET_ENCOUNTER` domain commands

### Steps

- [ ] Expose `Complete Encounter` during `ACTIVE`.
- [ ] Do not expose completion while prompts are unresolved.
- [ ] Render `COMPLETED` as an explicit read-only state.
- [ ] In `COMPLETED`, provide:
  - `Prepare Rematch`, dispatching `RESET_ENCOUNTER`;
  - `Export Encounter`;
  - `Start New Encounter…`, using the safe discard flow.
- [ ] Ensure `Prepare Rematch` preserves the intended combatant setup according to the domain contract.
- [ ] Ensure completed encounters do not unexpectedly resume as active after reload.
- [ ] Add phase-specific empty/help text so a completed encounter does not resemble a broken active screen.

### Verification

- [ ] Test legal lifecycle transitions.
- [ ] Test that illegal lifecycle actions are absent or disabled.
- [ ] Reload after completion and verify the app follows the documented completed-encounter behavior.

**Acceptance:** A GM can start, run, finish, review, rematch, or intentionally discard an encounter without conflating those actions.

---

## Task 4: Add Undo and Redo

**Purpose:** Make ordinary table mistakes recoverable.

**Size:** Large. Keep this in its own PR.

**Likely files:**

- Create `src/lib/history/encounter-history.ts`
- Create `src/lib/history/encounter-history.test.ts`
- Modify `src/routes/+page.svelte`
- Modify `src/components/EncounterHeader.svelte`
- Modify `src/components/EncounterHeader.test.ts`
- Modify `src/domain/types.ts` only if log metadata needs extension
- Modify combat-log rendering/tests if undone entries are displayed

### History contract

- [ ] Keep a bounded in-memory history of 50 accepted state-changing commands.
- [ ] Store enough information to restore state in O(1).
- [ ] Do not add rejected or no-op commands.
- [ ] A new command after undo truncates the redo branch.
- [ ] History is intentionally not persisted across reload.
- [ ] Do not put library CRUD, imports, or settings changes on the encounter history stack.
- [ ] Decide and document how local dice-roll log entries behave under undo; they do not change encounter mechanics and should not create history frames.

### UI

- [ ] Add labelled Undo and Redo controls in the encounter header.
- [ ] Show the affected action in tooltips where possible.
- [ ] Add:
  - `Ctrl/Cmd+Z` for Undo;
  - `Ctrl/Cmd+Shift+Z` for Redo.
- [ ] Do not trigger shortcuts while the user is editing text or a number.
- [ ] Disable unavailable actions clearly.

### Combat log

- [ ] Preserve a readable audit trail.
- [ ] Prefer marking command-derived log entries as undone/dimmed over silently deleting them.
- [ ] Keep implementation consistent with `pf2e-domain-events-spec.md`.

### Verification

- [ ] Test HP, temporary HP, conditions, initiative order, reaction state, notes, death/revival, template adjustment, prompt resolution, and encounter completion.
- [ ] Test redo truncation after a new command.
- [ ] Test history cap.
- [ ] Test keyboard-shortcut guards in input fields.

**Acceptance:** The GM can deterministically undo and redo the principal encounter operations without corrupting prompts, initiative, or persistence.

---

## Task 5: Fix tablet hit areas and control density

**Purpose:** Make frequent actions reliable with fingers, not just a mouse.

**Files likely affected:**

- `src/components/ui/Button.svelte`
- `src/components/ui/IconButton.svelte`
- `src/components/ui/StatRollButton.svelte`
- `src/components/InlineNumberEdit.svelte`
- `src/components/CombatantCard.svelte`
- `src/components/CombatantPromptResolution.svelte`
- `src/components/EncounterHeader.svelte`
- associated component tests and styles

### Steps

- [ ] Introduce a shared minimum interactive size token, for example `--tap-target-min: 44px`.
- [ ] Apply it on coarse pointers and supported tablet-width layouts.
- [ ] Use real control boxes instead of overlapping pseudo-element targets for adjacent controls.
- [ ] Audit:
  - HP and temporary HP;
  - Fortitude, Reflex, and Will rolls;
  - attack and damage rolls;
  - initiative reorder;
  - overflow menu;
  - condition increment/decrement/value/remove;
  - prompt actions;
  - End Turn and lifecycle controls.
- [ ] Preserve information density by grouping controls and using compact visual content inside adequately sized targets.
- [ ] Verify that enlarged controls do not overlap or push essential card information out of view.

### Acceptance viewports

- [ ] 1440×900 desktop.
- [ ] 1024×768 landscape tablet.
- [ ] 768×1024 portrait tablet.

At both tablet sizes:

- [ ] No horizontal document overflow.
- [ ] Current combatant, HP, conditions, and End Turn remain immediately visible.
- [ ] All frequent touch actions meet the target-size contract.

**Acceptance:** The tablet UI is operable without precision tapping.

---

## Task 6: Prioritize the combat workspace during ACTIVE

**Purpose:** Reduce scrolling and competing setup UI during play without blocking reinforcements.

**Files:**

- Modify `src/routes/+page.svelte`
- Modify `src/components/LibraryPane.svelte`
- Modify `src/components/SetupPanel.svelte`
- Modify `src/components/CombatLogDrawer.svelte`
- Update related tests

### Steps

- [ ] On transition to `ACTIVE`, collapse the library/setup pane once.
- [ ] Do not continuously force it closed; the GM may need reinforcements.
- [ ] Use an obvious `Library / Add Reinforcement` control to reopen it.
- [ ] Collapse the combat log by default on tablets while keeping its entry count visible.
- [ ] Preserve the user’s current drawer state when resolving prompts.
- [ ] Collapse the custom-combatant form after a successful add.
- [ ] Keep desktop collapse behavior available and explicit.

**Acceptance:** Combat cards dominate the active-session viewport, while adding a reinforcement remains no more than one clear action away.

---

## Task 7: Make actions discoverable and correct card semantics

**Purpose:** Ensure every operation has a visible route and clean keyboard/accessibility behavior.

**Files:**

- Modify `src/components/CombatantCard.svelte`
- Modify `src/components/CombatantCard.test.ts`
- Modify `src/components/RadialConditionMenu.svelte`
- Modify `src/components/CombatantDetailsPanel.svelte`
- Modify associated tests

### Steps

- [ ] Add `Manage Effects…` to the visible combatant overflow.
- [ ] Add `Remove Combatant…` to the visible overflow with confirmation.
- [ ] Keep long-press/right-click radial behavior as an optional shortcut.
- [ ] Add a concise first-use hint for the radial shortcut without blocking play.
- [ ] Remove `role="button"` and `tabindex="0"` from the entire combatant `<article>`.
- [ ] Retain a proper dedicated selection/details button in the card heading.
- [ ] Keep pointer selection on safe non-interactive card space only if it does not create misleading semantics.
- [ ] Ensure closed overflow-menu actions are not focusable.
- [ ] Ensure interactive descendants do not trigger card selection.
- [ ] Review the pinned-details behavior:
  - expose a visible pinned/following state;
  - offer `Follow active turn` when details are pinned;
  - make tablet close/unpin behavior consistent with desktop.

### Verification

- [ ] Keyboard-only pass through a three-combatant encounter.
- [ ] Screen-reader-oriented DOM inspection: no nested button roles.
- [ ] Test that card actions do not accidentally select or pin the card.
- [ ] Test both visible and radial routes for effects/removal.

**Acceptance:** No required feature depends on an undisclosed gesture, and card focus/selection behavior is understandable.

---

## Task 8: Implement encounter YAML export and import

**Purpose:** Support preparation, archival, transfer, and recovery.

**Size:** Large. Keep separate from first-run visual work.

**Files:**

- Modify `pf2e-yaml-schema-spec.md`
- Extend `src/lib/yaml/`
- Add focused serializer/parser tests
- Modify `src/routes/+page.svelte`
- Add export/import UI components as needed

### Export

- [ ] Export full encounter state during `PREPARING` and `COMPLETED`.
- [ ] Do not export undo/redo history.
- [ ] Include a schema version and document kind.
- [ ] Produce stable, reviewable YAML.

### Import

- [ ] Validate completely before replacing current state.
- [ ] Import into `PREPARING`, never directly into active combat.
- [ ] If another encounter exists, require confirmation before replacement.
- [ ] Present actionable validation errors with field paths.
- [ ] Preserve compatibility policy for older schema versions.

### Verification

- [ ] Round-trip encounter name, combatants, initiative order/scores, HP, effects, notes, templates, and relevant setup data.
- [ ] Verify invalid import leaves the current encounter untouched.
- [ ] Verify completed exports re-import into `PREPARING`.

**Acceptance:** A GM can prepare an encounter in advance, archive it after play, and restore it later without editing IndexedDB.

---

## Task 9: Improve first-run and empty-state guidance

**Purpose:** Let a new GM reach a runnable encounter without already knowing the file formats.

**Files:**

- Modify `src/routes/+page.svelte`
- Modify `src/components/LibraryPane.svelte`
- Modify `src/components/SetupPanel.svelte`
- Add/update tests
- Optional: add a small bundled sample encounter fixture

### Steps

- [ ] Replace the blank center area with a focused empty state offering:
  - `Import Creatures`;
  - `Create Custom Combatant`;
  - `Import Encounter`;
  - optionally `Load Sample Encounter`.
- [ ] Explain supported YAML and Foundry JSON sources briefly.
- [ ] Explain that party members are required for encounter-difficulty calculation.
- [ ] Keep advanced library management secondary.
- [ ] If a sample is included, keep it local, small, and clearly removable.

**Acceptance:** A first-time user can discover how to create and start an encounter without consulting repository documentation.

---

## Task 10: Add browser-level session workflows

**Purpose:** Cover behavior that jsdom component tests cannot verify: responsive layout, persistence, real focus, and touch ergonomics.

**Decision required during implementation:** Choose the smallest browser-testing setup that can emulate touch/coarse pointers without entering the production bundle. Playwright is acceptable as a development dependency if its CI/runtime cost remains reasonable.

### Required workflows

- [ ] First-run empty state to active encounter.
- [ ] Roll initiative, start, damage, condition, prompt, and end turn.
- [ ] Safe discard cancellation and confirmation.
- [ ] Complete encounter and prepare rematch.
- [ ] Undo/redo.
- [ ] Reload recovery during:
  - `PREPARING`;
  - `ACTIVE`;
  - `RESOLVING`;
  - `COMPLETED`.
- [ ] Landscape and portrait tablet drawer behavior.
- [ ] Touch-target measurement.
- [ ] Keyboard focus through combatant cards and menus.

**Acceptance:** The highest-risk table workflow runs automatically in a real browser and fails on regressions in layout or interaction.

---

## Task 11: Reconcile specs, roadmap, and release readiness

**Purpose:** Make repository documentation reflect what the application actually does.

### Steps

- [ ] Update `ROADMAP.md` after each completed slice rather than waiting until the end.
- [ ] Correct stale items for persistence, combat log, prompt resolution, spellcasting, and any other implemented feature found during the work.
- [ ] Add explicit completion criteria for the table-session UI milestone.
- [ ] Review canonical Markdown specs for UI promises not exposed by implementation.
- [ ] Do not edit transcript-style `.txt` exports when authoritative Markdown exists.

**Acceptance:** A new session can determine implemented, deferred, rejected, and planned behavior from the Markdown documents without reverse-engineering the code.

---

## Final validation gate

- [ ] Run:

  ```powershell
  npm run check
  npm run test:run
  npm run audit
  npm run build
  git diff --check
  ```

- [ ] Run browser workflows at all three target viewports.
- [ ] Test a touch/coarse-pointer context, not only resized desktop Chrome.
- [ ] Verify no browser console errors or warnings.
- [ ] Verify active encounter recovery after a reload.
- [ ] Verify one tap cannot discard an encounter.
- [ ] Verify every required action has a visible, non-long-press route.
- [ ] Review the final changed-file list and ensure unrelated `.claude/launch.json` remains untouched unless separately requested.

---

## Recommended delivery sequence

1. Remove Delay/Resume automation and migrate legacy state.
2. Add safe discard confirmation.
3. Complete the encounter lifecycle.
4. Implement Undo/Redo.
5. Fix tablet hit areas.
6. Prioritize the ACTIVE combat workspace.
7. Improve discoverability and card semantics.
8. Implement encounter YAML import/export.
9. Add first-run guidance.
10. Add browser-level workflows.
11. Finish roadmap/spec reconciliation and run the release gate.

Tasks 1–4 are the session-safety release boundary. Tasks 5–7 are the physical-table usability boundary. Tasks 8–11 complete portability, onboarding, and regression protection.
