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

## M2 Initiative and Combat State

- [x] Implement `END_TURN`, round advancement, and reaction reset.
- [x] Implement `DELAY` and `RESUME_FROM_DELAY`.
- [x] Implement `MARK_DEAD`, `REVIVE`, `MARK_REACTION_USED`, `RESET_REACTION`, and `SET_NOTE`.
- [x] Add all-dead edge case handling.

## M3 Effects and Conditions

Track A. Order: effect handlers first, then derived stacking, then prompts.

- [x] Add built-in condition and persistent damage library. (Implemented in PR #31.)
- [ ] Implement `APPLY_EFFECT`, `REMOVE_EFFECT`, value changes, and duration changes. (Issue #10. Unblocks #11, #12, and the conditions UI in #45.)
- [ ] Implement implied effects and removal cascades. (Issue #10.)
- [ ] Implement PF2e stacking derivation. (Issue #11. Depends on #10.)
- [ ] Implement turn-boundary prompt generation. (Issue #12. Depends on #10 and #11.)

## M4 Persistence and Import

Track C. Order: encounter persistence first so other persistence work can reuse the storage helper.

- [ ] Add IndexedDB persistence for active encounter state. (Issue #13.)
- [ ] Add YAML envelope import/export. (Issue #14.)
- [ ] Add creature import validation. (Issue #14 covers schema; per-document validation is part of that slice.)
- [ ] Add settings storage for user-owned parser API keys. (Issue #47. Depends on #13.)
- [ ] Replace hardcoded creature library with import-driven storage. (Issue #48. Depends on #14.)

## M5 Combat UI

Track B. Slice numbering follows the umbrella issues #15 (combat screen) and #16 (prompt panel + log).

- [x] Slice 1 — extract combatant UI into components. (Issue #28.)
- [ ] Slice 3 — turn controls on combatant cards. (Issue #38.)
- [ ] Slice 4 — combatant notes UI. (Issue #40.)
- [ ] Slice 5 — per-card HP delta controls. (Issue #39.)
- [ ] Slice 6 — dead/unconscious visual state. (Issue #43.)
- [ ] Slice 7 — tablet-first responsive layout pass. (Issue #44.)
- [ ] Slice 8 — append-only combat log component. (Issue #41.)
- [ ] Slice 9 — prompt resolution panel. (Issue #46. Depends on #12.)
- [ ] Slice 10 — conditions UI on combatant cards. (Issue #45. Depends on #10.)
- [ ] Manual static Cloudflare Pages deployment verification.

## M6 Spellcasting (deferred)

Tracking only. Captured in issue #49. Domain commands are stubbed in `src/domain/types.ts` but not wired in `applyCommand`.

- [ ] Wire `USE_SPELL_SLOT`, `RESTORE_SPELL_SLOT`, `SET_SPELL_SLOT_USAGE`, and `RESET_SPELL_BLOCK`.
- [ ] Wire `USE_FOCUS_POINT`, `RESTORE_FOCUS_POINT`, `SET_FOCUS_USAGE`.
- [ ] Wire `USE_INNATE_SPELL`, `RESTORE_INNATE_SPELL`, `SET_INNATE_USAGE`.
- [ ] Add spellcasting block UI on combatant cards.

## Deferred milestones

Specs are authoritative; tracking issues hold scope so the work is not lost. None of these are in the active backlog filter.

- **Hazards** — issue #50, spec `pf2e-hazards-spec.md`. Hazards as initiative participants with reactions, triggers, and disables.
- **Afflictions** — issue #51, spec `pf2e-afflictions-spec.md`. Poison/disease/curse staging, saves, and turn-boundary prompts.
- **Party members** — issue #52, spec `pf2e-party-members-spec.md`. PCs as first-class persisted entities, not ad-hoc combatants.
- **Creature types** — spec `pf2e-creature-types-spec.md`. Folds into #48 once the import-driven creature library lands.
