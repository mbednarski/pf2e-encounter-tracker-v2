/**
 * Maintainer-only: refresh static/spell-index.json from Foundry pf2e spell pack.
 *
 * Usage:
 *   npm run spells:import
 *
 * Requires `FOUNDRY_PF2E_DIR` env var pointing at a local clone of
 * github.com/foundryvtt/pf2e checked out at the desired release tag.
 *
 * Why a local clone vs. fetching from GitHub at runtime: the script stays
 * deterministic and offline-capable, and the operator can preview the source
 * data before regenerating.
 *
 * Spell pack layout in the Foundry pf2e system repo:
 *   packs/pf2e/spells/spells/rank-N/<slug>.json   (core spells)
 *   packs/pf2e/spells/focus/<subcategory>/<slug>.json
 *   packs/pf2e/spells/rituals/<slug>.json
 *
 * The script walks the entire packs/pf2e/spells directory recursively so it
 * works regardless of how Paizo reorganises subdirectories in future releases.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { transformSpell } from './spell-index/transform';
import type { SpellIndexEntry, SpellIndexFile } from '../src/lib/spell-index/types';

const SRC = process.env.FOUNDRY_PF2E_DIR;
if (!SRC) {
  console.error('Set FOUNDRY_PF2E_DIR to a local clone of foundryvtt/pf2e checked out at the desired tag.');
  process.exit(1);
}

// The Foundry pf2e system repo uses packs/pf2e/spells (not packs/spells).
// Fall back to packs/spells for older layouts so the script is forward/backward-compatible.
function resolveSpellsDir(repoDir: string): string {
  const candidates = [
    join(repoDir, 'packs', 'pf2e', 'spells'),
    join(repoDir, 'packs', 'spells'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]; // will fail below with a clear message
}

const SPELLS_DIR = resolveSpellsDir(SRC);
if (!existsSync(SPELLS_DIR)) {
  console.error(`Spells dir not found: ${SPELLS_DIR}`);
  console.error(`Tried: packs/pf2e/spells and packs/spells under ${SRC}`);
  process.exit(1);
}

function detectSourceTag(repoDir: string): string {
  try {
    return execSync('git describe --tags --always', { cwd: repoDir }).toString().trim();
  } catch {
    return 'unknown';
  }
}
const SOURCE_TAG = detectSourceTag(SRC);

// Walk the spells directory recursively because the Foundry pack uses
// category/rank-based subdirectories (e.g. packs/pf2e/spells/spells/rank-3/fireball.json).
function collectJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('_')) continue; // skip _folders.json and similar meta files
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...collectJsonFiles(full));
    else if (entry.endsWith('.json')) out.push(full);
  }
  return out;
}

const files = collectJsonFiles(SPELLS_DIR);
const spells: SpellIndexEntry[] = [];
const issues: { file: string; reason: string }[] = [];

for (const f of files) {
  const text = readFileSync(f, 'utf-8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    issues.push({ file: f, reason: `JSON parse error: ${(err as Error).message}` });
    continue;
  }
  const result = transformSpell(parsed);
  if (result.ok) {
    spells.push(result.value);
  } else {
    issues.push({ file: f, reason: result.reason });
  }
}

spells.sort((a, b) => a.slug.localeCompare(b.slug));

const output: SpellIndexFile = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: { repo: 'foundryvtt/pf2e', tag: SOURCE_TAG },
  spells
};

writeFileSync(join(process.cwd(), 'static', 'spell-index.json'), JSON.stringify(output));

console.log(`Imported ${spells.length} spells from ${files.length} files.`);
console.log(`  cantrips: ${spells.filter((s) => s.isCantrip).length}`);
console.log(`  with heightening: ${spells.filter((s) => s.heightening).length}`);
console.log(`  with damage: ${spells.filter((s) => s.base.damage).length}`);
if (issues.length > 0) {
  console.warn(`\nSkipped ${issues.length} files:`);
  for (const i of issues.slice(0, 20)) console.warn(`  ${i.file}: ${i.reason}`);
  if (issues.length > 20) console.warn(`  ... and ${issues.length - 20} more.`);
}
