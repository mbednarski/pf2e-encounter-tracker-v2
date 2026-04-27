# Repository Guidelines

## Project Structure & Module Organization
This repository is currently specification-first. Canonical design docs live at the repo root as `pf2e-*-spec.md` files, for example `pf2e-afflictions-spec.md`. Additional root-level `# PF2e Encounter Tracker v2 — *.txt` files are working exports and reference material; treat the Markdown specs as the authoritative source when both exist. There is no `src/`, `tests/`, or asset pipeline yet.

## Build, Test, and Development Commands
There is no application build or automated test script in this repository yet. Current work is document-focused.

- `rg --files` lists the active file set quickly.
- `Get-Content .\pf2e-afflictions-spec.md -TotalCount 40` previews a spec without opening an editor.
- `git status` verifies the intended files changed.
- `git diff --stat` checks review scope before committing.

If you add real implementation tooling later, update this section in the same change.

## Coding Style & Naming Conventions
Write specs in Markdown with clear headings, short paragraphs, and fenced `typescript` blocks for interfaces, unions, commands, and events. Use established domain terms consistently: `CombatantId`, `AppliedEffect`, `DomainEvent`, `SpellcastingBlock`, and similar names already present in the architecture material. Name new canonical documents `pf2e-<topic>-spec.md` in lowercase kebab-case.

## Testing Guidelines
There is no automated test suite yet. Review changes against the locked architectural rules: pure domain logic, GM-authority behavior, serializable command/event payloads, and strict separation between domain and UI concerns. For any substantial spec change, include at least one worked example or edge-case flow.

## Commit & Pull Request Guidelines
The Git history is empty today, so set the convention now: use short imperative commit subjects such as `Add hazard subsystem spec` or `Refine command rejection rules`. Keep each commit focused on one subsystem or one decision set. Pull requests should summarize the affected spec, list newly locked decisions, and call out any unresolved questions. UI screenshots are only relevant once implementation files exist.

## Contributor Notes
This project is still in the specification phase. Do not add scaffolding, dependencies, or implementation code unless the task explicitly calls for it. Prefer updating authoritative `.md` specs instead of duplicating corrections across the transcript-style `.txt` files.
