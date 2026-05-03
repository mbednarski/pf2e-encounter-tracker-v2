# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working agreement

- **Always work on a feature branch.** Never commit to `master` directly.
- **End every task with a Pull Request** — push the branch and open a PR with `gh pr create`.
- **Frontend-only scope.** Do not add backends, server endpoints, or non-static infrastructure.

## Commands

```
npm run dev                           # Vite dev server
npm run check                         # svelte-kit sync + svelte-check + tsc on domain
npm run test:run                      # Vitest, full suite
npx vitest run path/to/file.test.ts   # single test file
npx vitest run -t "test name"         # single test by name
npm run audit                         # npm audit, fails at moderate severity or higher
npm run build                         # static Cloudflare Pages build into ./build
```

Pre-PR gate (also Cloudflare's build command, also CI):

```
npm run check && npm run test:run && npm run audit && npm run build
```

All four must pass before opening a PR.

## package-lock.json discipline

Dev happens on Windows; CI and Cloudflare build on Linux. `npm install` only writes optional dependencies for the current platform, so a Windows-regenerated lockfile is missing Linux-only packages (e.g. rolldown's `@emnapi/runtime` chain) and `npm ci` on Linux fails with `Missing: ... from lock file`.

The `Refresh package-lock.json on Linux` workflow handles this automatically. On every push to a non-`master` branch, it does an `npm ci --dry-run` preflight; if the lockfile is in sync, it exits in seconds. If the lockfile is out of sync, it regenerates it on `ubuntu-latest` and pushes the result back to the branch.

After the bot pushes a regen commit:
1. `git pull` locally before any further commits, or you'll merge-conflict on `package-lock.json`.
2. Re-run any failing CI check on the PR — a token-pushed commit does not auto-trigger downstream workflows by GitHub's design. (Pushing any new commit yourself also re-triggers CI naturally.)

Manual trigger (once the workflow is on `master`):

```
gh workflow run refresh-lockfile.yml --ref <branch-name>
```

## Architecture (big picture)

Strict unidirectional layering. Edits must respect this direction:

```
src/routes/ (Svelte routes)  ──>  src/components/ (Svelte UI)  ──>  src/lib/ (orchestrator)  ──>  src/domain/ (pure TS)
```

- **`src/domain/`** — Pure reducer + types. Zero framework deps. State and events are JSON-serializable. Vitest covers this layer. Purity is enforced by `tsconfig.domain.json` via `tsc -p tsconfig.domain.json --noEmit` (run as part of `npm run check`).
- **`src/lib/`** — Orchestrator glue: `dispatchEncounterCommand`, `newEncounterState`, the creature library. TS-only; no Svelte. The only layer that bridges UI and domain.
- **`src/components/`** — Reusable Svelte components. Presentational: receive state via props, emit intentions via callback props. **Must not own encounter state** and must not call `dispatchEncounterCommand` directly. May import types and helpers from `$lib` and `../domain`.
- **`src/routes/`** — SvelteKit file-based routes. Holds encounter state, owns command dispatch, composes components. `+layout.ts` enables prerender + SSR for static export.

Command flow:

```
UI button → runCommand(cmd)
          → dispatchEncounterCommand(state, feedback, cmd)
          → applyCommand(state, cmd)    [pure domain reducer]
          → { state, events }
          → UI re-renders; events appended to log
```

Key domain shapes (in `src/domain/types.ts`): `EncounterState`, `CombatantState`, `Command` (≈42 variants), `DomainEvent`. Reducer entry point: `applyCommand` in `src/domain/reducer.ts`.

## Hard constraints

- **Domain purity.** `src/domain/` must not import Svelte, SvelteKit, browser APIs, IndexedDB, or anything from `src/lib` or `src/routes`. If domain code needs browser state, lift it into the orchestrator instead.
- **No server runtime.** No Cloudflare Pages Functions, Workers, KV, D1, R2, or Workers AI. Static assets only. Do not add server endpoints unless the task explicitly redesigns the architecture.
- **Specs vs scratch.** Treat `pf2e-*-spec.md` at the repo root as authoritative. `.txt` exports and `Untitled-*.txt` are non-canonical scratch — do not cite them as source of truth. Start from `pf2e-tracker-v2-architecture-spec.md` (section 19.2 indexes the rest).

## Tests

Vitest. Test files are colocated with source as `*.test.ts` (e.g. `src/domain/reducer.test.ts`). Shared fixtures and builders live in `src/domain/test-support.ts` — prefer them over hand-rolling state in new tests.

## Other docs

- `AGENTS.md` — repo-wide contributor guidelines (commit style, spec naming, deployment notes).
- `ROADMAP.md` — milestone status (M0–M5). Check this before picking up new work to see what's in scope for the current slice.
