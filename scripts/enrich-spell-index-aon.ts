/**
 * Maintainer-only: enrich static/spell-index.json with direct Archives of
 * Nethys page links, in place, without regenerating from the Foundry source.
 *
 * Usage:
 *   npm run spells:enrich
 *
 * Use this when only the AoN links need refreshing (e.g. AoN republishes
 * remastered content). A full `npm run spells:import` also resolves links, but
 * requires a local Foundry pf2e clone; this script only needs network access to
 * AoN's public Elasticsearch index.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchAonIndex, resolveAonUrl } from './spell-index/aon-ids';
import type { SpellIndexFile } from '../src/lib/spell-index/types';

const INDEX_PATH = join(process.cwd(), 'static', 'spell-index.json');

const file = JSON.parse(readFileSync(INDEX_PATH, 'utf-8')) as SpellIndexFile;

const aonIndex = await fetchAonIndex();

let resolved = 0;
const unmatched: string[] = [];
for (const spell of file.spells) {
  const url = resolveAonUrl(aonIndex, spell.name, spell.baseLevel);
  if (url) {
    spell.aonUrl = url;
    resolved++;
  } else {
    unmatched.push(spell.name);
  }
}

writeFileSync(INDEX_PATH, JSON.stringify(file));

console.log(`Enriched ${resolved} / ${file.spells.length} spells with direct AoN links.`);
if (unmatched.length > 0) {
  console.warn(`Unmatched (kept search-URL fallback): ${unmatched.length}`);
  for (const name of unmatched.slice(0, 30)) console.warn(`  ${name}`);
  if (unmatched.length > 30) console.warn(`  ... and ${unmatched.length - 30} more.`);
}
