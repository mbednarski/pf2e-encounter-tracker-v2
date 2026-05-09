import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { importCreatureYaml } from '../src/lib/yaml/index.ts';

function usage(): never {
  console.error('Usage: npm run yaml:check -- <path-to-yaml>');
  process.exit(2);
}

const filePath = process.argv[2];
if (!filePath) {
  usage();
}

const absolute = resolve(filePath);
let text: string;
try {
  text = readFileSync(absolute, 'utf8');
} catch (err) {
  console.error(`Failed to read ${absolute}: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(2);
}

const { creatures, issues, skipped } = importCreatureYaml(text);

console.log(`File: ${absolute}`);
console.log(`Accepted creatures: ${creatures.length}`);
if (creatures.length > 0) {
  for (const c of creatures) {
    console.log(`  - ${c.id} (${c.name}, level ${c.level})`);
  }
}

if (skipped.length > 0) {
  console.log(`Skipped documents (kind not yet imported): ${skipped.length}`);
  for (const s of skipped) {
    console.log(`  - doc #${s.documentIndex}: kind=${s.kind}`);
  }
}

if (issues.length > 0) {
  console.error(`Validation issues: ${issues.length}`);
  for (const issue of issues) {
    const loc = issue.line !== undefined ? `:${issue.line}` : '';
    const path = issue.path ? ` (${issue.path})` : '';
    console.error(`  - doc #${issue.documentIndex}${loc}${path}: ${issue.message}`);
  }
  process.exit(1);
}

if (creatures.length === 0) {
  console.error('No creatures imported.');
  process.exit(1);
}

process.exit(0);
