# YAML import

Minimal cut of [issue #14](../../../../issues/14): only the `creature` document
kind is supported, and only on the import side. Round-trip export and the other
kinds (`effect-definition`, `encounter`, `spell`, `hazard`, `party-member`,
`companion`, `party`) are intentionally deferred to follow-up slices. See
`pf2e-yaml-schema-spec.md` at the repo root for the canonical envelope and
data shapes.

## Public API

```ts
import { importCreatureYaml } from '$lib/yaml';

const { creatures, issues } = importCreatureYaml(yamlText);
```

`creatures` is `Creature[]` from `src/domain/types.ts` — the runtime shape is
the same one the rest of the app uses. `issues` is a flat list with
`{ documentIndex, path, message }` so a multi-document stream can surface
per-document validation errors.

## Where to keep monster YAMLs

**Don't commit Paizo statblock content to this repo.** Bestiary text and
trademarked monster names are not ours to redistribute. Put your personal
creature library somewhere `.gitignore` covers — the repo ignores `/creatures/`
and `*.yaml.local` / `*.yml.local` for this purpose — or keep it entirely
outside the working tree.

The browser file picker reads the YAML locally. Nothing is uploaded.
