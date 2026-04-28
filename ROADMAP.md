# PF2e Encounter Tracker v2 Roadmap

This roadmap tracks implementation milestones. Canonical behavior still lives in the `pf2e-*-spec.md` files; roadmap items should link back to those specs when they become GitHub issues.

## M0 Foundation

- [x] Initialize SvelteKit, TypeScript, Vitest, and static Cloudflare Pages build.
- [x] Add first pure domain reducer slice for combatants, initiative setup, lifecycle, and HP commands.
- [x] Add dependency audit script that fails on known low-or-higher vulnerabilities.
- [ ] Add CI for `npm run check`, `npm run test:run`, `npm run audit`, and `npm run build`.
- [x] Expand command/event test fixtures for future domain tests.

## M1 Encounter Setup

- [x] Implement creature-to-combatant factory.
- [x] Implement weak/elite template adjustments.
- [x] Add encounter preparation UI for adding, naming, and ordering combatants.
- [x] Add basic creature display data on combatants.

## M2 Initiative and Combat State

- [ ] Implement `END_TURN`, round advancement, and reaction reset.
- [ ] Implement `DELAY` and `RESUME_FROM_DELAY`.
- [ ] Implement `MARK_DEAD`, `REVIVE`, `MARK_REACTION_USED`, `RESET_REACTION`, and `SET_NOTE`.
- [ ] Add all-dead edge case handling.

## M3 Effects and Conditions

- [ ] Add built-in condition and persistent damage library.
- [ ] Implement `APPLY_EFFECT`, `REMOVE_EFFECT`, value changes, and duration changes.
- [ ] Implement implied effects and removal cascades.
- [ ] Implement PF2e stacking derivation.
- [ ] Implement turn-boundary prompt generation.

## M4 Persistence and Import

- [ ] Add IndexedDB persistence for active encounter state.
- [ ] Add YAML envelope import/export.
- [ ] Add creature import validation.
- [ ] Add settings storage for user-owned parser API keys.

## M5 Combat UI

- [ ] Build tablet-first combat screen.
- [ ] Add combatant cards with HP, initiative, conditions, and notes.
- [ ] Add prompt resolution panel.
- [ ] Add append-only combat log.
- [ ] Add manual static Cloudflare Pages deployment verification.
