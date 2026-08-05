# PF2e Encounter Tracker v2 Roadmap

This roadmap tracks implementation milestones. Canonical behavior still lives in the `pf2e-*-spec.md` files; roadmap items should link back to those specs when they become GitHub issues.

The live, ordered backlog is the GitHub Project: [PF2e Tracker v2 backlog](https://github.com/users/mbednarski/projects/3). Issues there carry a **Track** field (A/B/C/Deferred) and an **Order** field that matches the next-up sequence; the deferred filter (`-track:Deferred`) hides tracking issues from the active view.

Active work is grouped into three parallel tracks. Within each track items are dependency-ordered; across tracks they are independent and can ship in any order.

- **Track A — close M3 (effects engine):** #10 → #11 → #12.
- **Track B — combat UI slices:** #38, #39, #40, #41, #43, #44, #45 (depends on #10), #46 (depends on #12).
- **Track C — persistence & import:** #13 → #14 → #47 (depends on #13) → #48 (depends on #14).

## M0 Foundation

- [x] Initialize SvelteKit, TypeScript, Vitest, and static Cloudflare Pages build.
- [x] Add first pure domain reducer slice for combatants, initiative setup, lifecycle, and HP commands.
- [x] Add dependency audit script that fails on known low-or-higher vulnerabilities.
- [x] Add CI for `npm run check`, `npm run test:run`, `npm run audit`, and `npm run build`.
- [x] Expand command/event test fixtures for future domain tests.

## M1 Encounter Setup

- [x] Implement creature-to-combatant factory.
- [x] Implement weak/elite template adjustments.
- [x] Add encounter preparation UI for adding, naming, and ordering combatants.
- [x] Add basic creature display data on combatants.
- [x] Creature adjustments redesign: snapshot + derive on read; structured optional fields (`save`, `damage`, `isLimitedUse`, `primaryDamageIndex`) under YAML `schemaVersion: 2`; mid-encounter `SET_TEMPLATE_ADJUSTMENT` toggle. (Spec: `docs/superpowers/specs/2026-05-13-creature-adjustments-design.md`.)

## M2 Initiative and Combat State

- [x] Implement `END_TURN`, round advancement, and reaction reset.
- [x] Delay is intentionally manual. The GM represents it by reordering initiative; the tracker does not automate its timing or effect-boundary semantics.
- [x] Implement `MARK_DEAD`, `REVIVE`, `MARK_REACTION_USED`, `RESET_REACTION`, and `SET_NOTE`.
- [x] Add all-dead edge case handling.

## M3 Effects and Conditions

Track A. Order: effect handlers first, then derived stacking, then prompts.

- [x] Add built-in condition and persistent damage library. (Implemented in PR #31.)
- [x] Implement `APPLY_EFFECT`, `REMOVE_EFFECT`, value changes, and duration changes. (Issue #10.)
- [x] Implement implied effects and removal cascades. (Issue #10.)
- [x] Implement PF2e stacking derivation. (Issue #11.)
- [x] Implement turn-boundary prompt generation. (Issue #12.)

## M4 Persistence and Import

Track C. Order: encounter persistence first so other persistence work can reuse the storage helper.

- [x] Add IndexedDB persistence for active encounter state, including PREPARING, ACTIVE, RESOLVING, and COMPLETED recovery. (Issue #13.)
- [x] Add YAML envelope parsing and validated encounter import/export. (Issue #14.)
- [x] Add creature, hazard, party-member, and encounter import validation with field-path issues.
- [x] Add settings storage for user-owned parser API keys. (Issue #47.)
- [x] Replace the hardcoded creature library with import-driven IndexedDB storage. (Issue #48.)

## M5 Combat UI

Track B. Slice numbering follows the umbrella issues #15 (combat screen) and #16 (prompt panel + log).

- [x] Slice 1 — extract combatant UI into components. (Issue #28.)
- [x] Slice 3 — turn controls on combatant cards. (Issue #38.)
- [x] Slice 4a — merge initiative track into combatant cards. (Groundwork for Slice 4 details panel.)
- [x] Slice 4b — combatant details panel scaffolding + selection. (Groundwork for Slice 4 notes editor.)
- [x] Slice 4 — combatant notes UI inside details panel. (Issue #40.)
- [x] Slice 5 — per-card HP delta controls. (Issue #39.)
- [x] Slice 6 — dead/unconscious visual state. (Issue #43.)
- [x] Slice 7 — tablet-first responsive layout, 44px touch targets, and active-workspace collapse behavior. (Issue #44.)
- [x] Slice 8 — append-only combat log component with undone-entry audit markers. (Issue #41.)
- [x] Slice 9 — prompt resolution panel. (Issue #46. Depends on #12.)
- [x] Slice 10 — conditions UI on combatant cards. (Issue #45.)
- [ ] Manual static Cloudflare Pages deployment verification.

## M6 Spellcasting

Usage tracking and the encounter details UI are implemented. Direct bulk/set/reset editing remains deferred.

- [x] Wire `USE_SPELL_SLOT` and `RESTORE_SPELL_SLOT`; defer `SET_SPELL_SLOT_USAGE` and `RESET_SPELL_BLOCK`.
- [x] Wire `USE_FOCUS_POINT` and `RESTORE_FOCUS_POINT`; defer `SET_FOCUS_USAGE`.
- [x] Wire `USE_INNATE_SPELL` and `RESTORE_INNATE_SPELL`; defer `SET_INNATE_USAGE`.
- [x] Add spellcasting block UI in combatant details.

## Table-Session UI Milestone

- [x] Delay is manual and legacy delayed combatants migrate without silent loss.
- [x] Discard is confirmed; completion, read-only review, rematch, and start-new are distinct.
- [x] Fifty-frame undo/redo covers accepted encounter commands and retains a readable audit trail.
- [x] Tablet layouts prioritize combat, expose reinforcement/library access, and use 44px frequent-action targets.
- [x] Effects and removal have visible routes; card and pinned-details semantics are keyboard-readable.
- [x] Encounter YAML supports preparation, archival, transfer, validation, and confirmed replacement.
- [x] First-run guidance and real-browser desktop/landscape/portrait workflows protect the primary table loop.

## M7 Complex Hazards

- [x] Add `Hazard` domain type, `HazardData`, and `createCombatantFromHazard` factory.
- [x] Add Foundry pf2e `hazard` actor JSON importer + YAML hazard validator.
- [x] Add IndexedDB hazard library (DB v5) with import/manage UI.
- [x] Add hazard combatant rendering: stat block, Stealth/Hardness, free-form routine + disable text. (Spec: `pf2e-hazards-spec.md`.)

## M8 Party Members

Issue #52, spec `pf2e-party-members-spec.md`. PCs as first-class persisted entities.

- [x] Persistent-effect sync-back on encounter completion (spec §4.5): Wounded/Doomed/afflictions written back to the stored record and carried into the next encounter.
- [ ] Companions and minion combatants (`masterId` turn-boundary processing, initiative exclusion, removal cascade).
- [ ] Parties and one-click "Add Party" encounter setup.

## Deferred milestones

Specs are authoritative; tracking issues hold scope so the work is not lost. None of these are in the active backlog filter.

- **Afflictions** — issue #51, spec `pf2e-afflictions-spec.md`. Poison/disease/curse staging, saves, and turn-boundary prompts.
- **Creature types** — spec `pf2e-creature-types-spec.md`. Folds into #48 once the import-driven creature library lands.
