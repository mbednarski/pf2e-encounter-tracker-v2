# Repository Guidelines

## Project Structure & Module Organization
This repository is transitioning from specification-first to implementation. Canonical design docs live at the repo root as `pf2e-*-spec.md` files, for example `pf2e-afflictions-spec.md`. Additional root-level `# PF2e Encounter Tracker v2 — *.txt` files are working exports and reference material; treat the Markdown specs as the authoritative source when both exist. Runtime code lives under `src/`, with the pure domain core in `src/domain/`.

## Build, Test, and Development Commands
Use npm for project tooling.

- `rg --files` lists the active file set quickly.
- `Get-Content .\pf2e-afflictions-spec.md -TotalCount 40` previews a spec without opening an editor.
- `npm install` installs the local toolchain.
- `npm run dev` starts the SvelteKit dev server.
- `npm run check` runs Svelte/TypeScript checks, including the domain-only tsconfig.
- `npm run test:run` runs Vitest.
- `npm run audit` fails on any known dependency vulnerability at low severity or higher.
- `npm run build` creates the static Cloudflare Pages build in `build`.
- `npm run deploy:pages` builds and uploads `build` to Cloudflare Pages with Wrangler.
- `git status` verifies the intended files changed.
- `git diff --stat` checks review scope before committing.

## Coding Style & Naming Conventions
Write specs in Markdown with clear headings, short paragraphs, and fenced `typescript` blocks for interfaces, unions, commands, and events. Use established domain terms consistently: `CombatantId`, `AppliedEffect`, `DomainEvent`, `SpellcastingBlock`, and similar names already present in the architecture material. Name new canonical documents `pf2e-<topic>-spec.md` in lowercase kebab-case. Implementation code is TypeScript in strict mode; keep `src/domain/` pure and framework-free.

## Testing Guidelines
Vitest covers the domain layer. Review changes against the locked architectural rules: pure domain logic, GM-authority behavior, serializable command/event payloads, and strict separation between domain and UI concerns. For any substantial spec change, include at least one worked example or edge-case flow.

## Commit & Pull Request Guidelines
The Git history is empty today, so set the convention now: use short imperative commit subjects such as `Add hazard subsystem spec` or `Refine command rejection rules`. Keep each commit focused on one subsystem or one decision set. Pull requests should summarize the affected spec, list newly locked decisions, and call out any unresolved questions. UI screenshots are only relevant once implementation files exist.

## Contributor Notes
Keep the app deployable to Cloudflare Pages using static assets and free services. Do not add Pages Functions, Workers, KV, D1, R2, or server-side endpoints unless the task explicitly calls for changing the architecture. Prefer updating authoritative `.md` specs instead of duplicating corrections across the transcript-style `.txt` files.
