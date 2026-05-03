# Handoff: Pathfinder 2e Encounter Tracker

## Overview

A GM-facing encounter tracker for Pathfinder 2e tabletop sessions. Manages the full initiative order during combat: PCs and enemies in one list, HP/AC/conditions/persistent damage at-a-glance on each combatant card, full statblocks + condition manager + spells + strikes in a details panel, a creature library (party + bestiary search), and a combat log of every action taken across rounds.

The design explores **two visual directions** plus dedicated **condition-picker UX studies** (a flat list-style picker AND a radial/pie menu). The user lands them all on a pan/zoom design canvas so directions can be compared side-by-side.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX** — static hi-fi prototypes showing the intended look, layout, and information architecture. They are **not production code** to copy directly.

The task is to **recreate these designs in the target codebase's environment** (React + your CSS solution of choice, Vue, SwiftUI, native, whatever the project uses) using its established patterns, component primitives, and design tokens. If no environment exists yet, React + Tailwind or React + CSS Modules are reasonable defaults — the layouts and components in this design were authored as React with inline styles and translate cleanly to either.

The HTML files demonstrate visual fidelity. Real implementation needs: state management, drag-and-drop reordering, persistence, dice-rolling logic, condition rule lookups, save-DC tracking, and combat-log mutation flow. The README's **Interactions & Behavior** section describes all of these.

## Fidelity

**High-fidelity** — exact colors, typography, spacing, component layouts. Two parallel design directions are provided (parchment / dark console). Pick one before implementing; do not blend.

## Screens / Views

The product is **single-screen, three-pane** (responsive: panes collapse on narrower viewports).

### Pane 1: Library (left, ~280px)
- **Tabs:** Party · Bestiary
- **Party tab** — list of saved PCs with class/ancestry/level subtitle, click or drag to add to encounter.
- **Bestiary tab** — search input (filters by name + traits live), level filter chips (−1 / 0 / 1–4 / 5–9 / 10+), trait filter pills (humanoid, undead, dragon, etc.). Each row: name, lvl badge, traits as small caps. Hover reveals "+ add" affordance.
- Empty state when no encounter active: "Drop creatures here to start an encounter."

### Pane 2: Initiative Tracker (center, flexible)
- **Header strip:** Round counter (Round 3), Turn counter (Turn 2 of 6), prev/next round controls, "Roll initiative" / "End encounter" actions, encounter timer.
- **Combatant cards** — vertical stack, one per combatant, sorted by initiative descending.
  - **Active card** — highlighted with a left accent bar in the direction's primary color, slightly larger.
  - **Card layout:**
    - Initiative number (large, 32px, in its own bordered cell)
    - Name + creature subtitle
    - Faction marker — PC vs enemy treatment (Direction A: ink ●/○ on rim; Direction B: green/red side-stripe)
    - HP cell (20–22px digits, color-coded: full → green; ≥50% → ink; <50% → amber; ≤25% → red; 0 → struck through with "DOWN")
    - HP mini-bar beneath the digits with temp-HP overlay if any
    - AC cell (26–28px, shield glyph)
    - Condition glyphs row (icons with stack values, e.g. "Frightened 2"). Hover any glyph: tooltip with rules text.
    - Persistent-damage row (if any): die-icon + type ("1d6 bleed").
    - Action economy pips on active card only: 3 ◇ slots (filled when used) + reaction pip
  - Reorder grips (↑↓) on hover.

### Pane 3: Details + Combat Log (right, ~420px)
Tab strip at top: **Statblock · Conditions · Combat Log**

- **Statblock tab:**
  - Name, type, level, traits row.
  - AC, Perception, speeds in a 3-column header.
  - Saves grid (Fort/Ref/Will).
  - Skills (comma-list).
  - Immunities, resistances (with values), weaknesses (with values).
  - **Strikes** — list of attack rows with name, +to-hit, damage formula, traits.
  - **Spells** (if applicable) — by rank, with slots-used dots and prepared-spell list.
  - **Notes** — free-text GM scratchpad.
- **Conditions tab:**
  - Currently-applied list with value, duration, source, and "End now" button per condition.
  - "+ Add condition" button → opens picker (flat-list OR radial — see Condition UX section).
  - Persistent damage with end-of-turn flat check button.
- **Combat Log tab** (also accessible as a collapsible bottom drawer):
  - Reverse-chronological entries grouped by round.
  - Entry types color-coded: hit (default), crit (red), miss (muted), spell (blue), condition (amber), action (ink), system (italic).
  - Filter chips (round, actor, type), export-to-text button.

### Condition Picker — Two UX Approaches

**Flat-list picker** (3 states mocked):
1. **Add** — search bar + recent-row + common-conditions grid, keyboard-navigable, ↵ to apply.
2. **Edit** — click an applied glyph: stepper (−/+ with 1/2/3/4 chips), contextual rules text, duration pills (End of turn / 1 round / 10 min / Until removed / Sustained), source link, history strip, "End now" destructive button.
3. **Right-click menu** — quick-path commands with shortcut keys (↑/↓ value, R refresh duration, T transfer, E edit, Del remove).

**Radial menu** (4 states mocked, all in one continuous gesture):
1. **Trigger** — right-click on combatant card.
2. **Hub** — 6 wedges (Recent · Conditions · Persistent · Afflictions · Buffs · Remove). Center confirms target with portrait/HP/current conditions.
3. **Sub-arc** — hover a wedge: concentric ring fans out with that category's items, sorted by frequency. Already-applied items show a rim pip.
4. **Scrub value** — drag along the outer arc to set a condition's value (1–4).

DCs (flat checks for persistent damage, save-ends conditions, afflictions) attach as small circular pips on the rim of any condition glyph, color-coded by save type (Fort red / Ref green / Will blue / flat amber). Clicking the pip rolls inline and resolves.

## Interactions & Behavior

- **Add to encounter:** drag from Library pane onto the initiative list, OR click + button on a library row. Newly-added creature prompts for initiative roll (auto-rolls if PC has Perception modifier set).
- **Reorder:** drag any card vertically to override initiative order; or use ↑/↓ grips. Reorders persist for the encounter.
- **Advance turn:** ⌘↵ or "Next" button → highlight moves to next combatant, action pips reset, Frightened auto-decrements −1 on each owner's end-of-turn (with undo toast), persistent damage prompts flat-check rolls.
- **Apply damage / healing:** click HP cell → inline numeric stepper opens with type selector (B/P/S + elemental). Resistances/weaknesses auto-apply and show a calculation tooltip. Logs to combat log.
- **Apply condition:** click "+ Add condition" OR right-click card (radial menu). See Condition Picker section.
- **Roll initiative:** "Roll initiative" header button rolls Perception+modifier for every combatant lacking an init value.
- **Save & load:** encounters persist to localStorage; named saves available.
- **Combat log:** every state mutation auto-logs. Crits/misses/saves recorded with the underlying d20 + modifier.

## State Management

- **Encounter** — `{ round, turn, combatantIds[], activeIdx, log[] }`
- **Combatant** — `{ id, name, kind: 'pc'|'enemy', init, hp, maxHp, tempHp, ac, statblock, conditions: ConditionInstance[], persistent: PersistentInstance[], notes, actionsRemaining, reactionUsed }`
- **ConditionInstance** — `{ ref: string (key into CONDITIONS_REF), value: number|null, duration: 'turn'|'round'|'min'|'untilRemoved'|'sustained'|'saveEnds', saveDC?: number, saveType?: 'fort'|'ref'|'will'|'flat', source?: combatantId, appliedRound, appliedTurn, history: [{round, turn, action: 'applied'|'inc'|'dec'|'tick'|'removed', delta?: number}] }`
- **PersistentInstance** — `{ type: 'bleed'|'fire'|'acid'|'poison'|'cold'|'electricity'|'mental', formula: string, recoveryDC: number (default 15) }`
- **LogEntry** — `{ round, turn, actor: combatantId, kind: 'hit'|'crit'|'miss'|'spell'|'condition'|'action'|'system', text, meta?: {...} }`

State should be a single normalized store (Zustand / Redux Toolkit / Pinia / SwiftData). Derive sorted-by-init list, current-actor, and recent-conditions from the store; don't mirror.

## Design Tokens

### Direction A — Reference Sheet (parchment)
**Colors**
- `bg`: `#FBF7EC` (page parchment)
- `panel`: `#F5EFE2` (cards / pane bg)
- `panel2`: `#F1E9D5` (header strips, active row)
- `ink`: `#1F1A14` (primary text, primary borders)
- `inkSoft`: `#5C5345` (secondary text)
- `inkMute`: `#8C8270` (tertiary text, labels)
- `rule`: `#D9CFB6` (light dividers)
- `ruleStrong`: `#B5A887` (medium dividers, frame edges)
- `red`: `#9B2D20` (HP critical, danger, crits)
- `green`: `#3F6B3A` (HP healthy, success)
- `amber`: `#A57A1F` (Frightened/condition warnings, HP wounded)
- `blue`: `#2F5773` (spells, links)

**Typography**
- Headings: `'Source Serif 4', Georgia, serif` — 600/700 weights
- UI / body: `Inter, sans-serif` — 400/500/600/700
- Numeric / monospace: `'JetBrains Mono', monospace` — for HP, AC, init, log timestamps

**Sizes**
- Init number: 32px / 700 / serif
- HP digits: 22px / 700 / mono
- AC: 28px / 700 / mono with shield glyph
- Card name: 16px / 600 / serif
- Card subtitle: 11px / 500 / Inter
- Labels (uppercase): 9–10px / 700 / Inter / letter-spacing 1.4 / uppercase
- Body: 12–13px / 400–500 / Inter

**Spacing & borders**
- 1px solid borders, no border-radius (intentional flat/printed feel)
- Drop shadow: `4px 6px 0 rgba(31,26,20,0.18)` for popovers
- Card padding: 12–14px
- Pane gutters: 16–20px

### Direction B — Console (dark)
**Colors** — derive a cool slate-based palette: `#0E1014` (bg), `#161A21` (panel), `#1F2630` (panel2), `#E6EAF0` (text), `#8B96A8` (secondary), color-coded HP states (`#3FB964` healthy → `#E6B23C` amber → `#E55A45` critical), accent `#6FB9FF` for active-turn highlight. Subtle 1px borders in `#252C36`. Use border-radius 4px sparingly (cards yes, chips no).

**Typography** — same family rationale as A but flip emphasis: `Inter` for almost everything; `JetBrains Mono` for ALL numeric/HUD labels (init, HP/maxHP, AC, DCs); minimal serif use.

## Assets

- All glyphs in the design are Unicode or simple SVG inline — no external icon library. For production, use Lucide (most match) or Phosphor.
- No images in the mocks. PCs and creatures should support portrait uploads in production; placeholder shows initials.
- Fonts via Google Fonts: Source Serif 4, Inter, JetBrains Mono.

## Files

- `PF2e Encounter Tracker.html` — entry point, hosts the design canvas.
- `design-canvas.jsx` — pan/zoom canvas component (presentation only; not part of the product).
- `data.jsx` — sample encounter data (party, bestiary, sample combatants, conditions reference, sample combat log).
- `direction-a.jsx` — Direction A (parchment) full encounter tracker mockup.
- `direction-b.jsx`, `direction-b-shared.jsx`, `direction-b-card.jsx` — Direction B (dark console) full encounter tracker mockup, split into render modules.
- `condition-states.jsx` — flat-list condition picker / editor / right-click menu states.
- `radial-menu.jsx` — radial / pie-menu condition picker, 4 states.

A full PF2e conditions reference (rules text, value/no-value flag) is partially seeded in `data.jsx` under `CONDITIONS_REF`. Production should use the Pathfinder 2e SRD (open-license) for the full set.
