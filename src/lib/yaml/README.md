# YAML import

Imports `creature` YAML documents into the in-memory creature library. The
canonical envelope and data shapes are defined in `pf2e-yaml-schema-spec.md`
at the repo root.

This module covers the import path only. Round-trip export and the other
document kinds the spec defines (`spell`, `effect-definition`, `hazard`,
`party-member`, `companion`, `party`, `encounter`) are not yet implemented:
documents with those kinds parse successfully through the envelope layer and
are reported as `skipped` so the orchestrator can surface them with an
informational message instead of an error.

This module performs no I/O — callers pass already-read text and the parsed
result is returned synchronously.

## Public API

```ts
import { importCreatureYaml, dedupeNewCreatures } from '$lib/yaml';

const { creatures, issues, skipped } = importCreatureYaml(yamlText);
```

`creatures` is `Creature[]` from `src/domain/types.ts` — the runtime shape is
the same one the rest of the app uses. `issues` is a flat list of
`ValidationIssue` (see `envelope.ts`), so a multi-document stream can surface
per-document validation errors. `skipped` lists documents whose `kind` is
recognized by the envelope but is not imported by this build.

`dedupeNewCreatures(existingIds, incoming)` partitions an `incoming`
`Creature[]` into `accepted` and `rejected` using id collision against
`existingIds`. The orchestrator passes the union of the built-in library
plus already-imported creatures, so built-ins always win on collision.

## Where to keep monster YAMLs

**Don't commit Paizo statblock content to this repo.** Bestiary text and
trademarked monster names are not ours to redistribute. Put your personal
creature library somewhere `.gitignore` covers — the repo ignores
`/creatures/` and `*.yaml.local` / `*.yml.local` for this purpose — or keep
it entirely outside the working tree.
