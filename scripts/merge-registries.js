#!/usr/bin/env node
/**
 * Merge all registry-*.json files in data/ into a single unified registry.
 *
 * Usage: node scripts/merge-registries.js [--output data/registry.json]
 *
 * Auto-discovers all registry-*.json files in the data/ directory.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

// Parse CLI args
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}
const outputPath = argValue('--output', join(dataDir, 'registry.json'));

// Auto-discover all registry-*.json files
const registryFiles = readdirSync(dataDir)
  .filter(f => f.startsWith('registry-') && f.endsWith('.json'))
  .sort()
  .map(f => join(dataDir, f));

if (registryFiles.length === 0) {
  console.error('No registry-*.json files found in data/. Run extract scripts first.');
  process.exit(1);
}

// Load all registries
const sources = [];
for (const filePath of registryFiles) {
  const data = JSON.parse(readFileSync(filePath, 'utf-8'));
  const sourceName = data.metadata?.source || filePath.match(/registry-(.+)\.json/)?.[1] || 'unknown';
  const entryCount = Object.keys(data.entries || {}).length;
  console.error(`Loaded ${sourceName}: ${entryCount} Thai names`);
  sources.push({ name: sourceName, data, entryCount });
}

// Merge into unified registry
const merged = new Map();

function addEntries(sourceEntries) {
  for (const [thai, entry] of Object.entries(sourceEntries)) {
    let existing = merged.get(thai);
    if (!existing) {
      existing = { variants: new Map(), featureClasses: new Set(), maxPopulation: 0 };
      merged.set(thai, existing);
    }

    for (const [latin, count] of Object.entries(entry.variants)) {
      const prev = existing.variants.get(latin) || 0;
      existing.variants.set(latin, prev + count);
    }

    for (const fc of (entry.featureClasses || [])) {
      existing.featureClasses.add(fc);
    }

    if (entry.maxPopulation) {
      existing.maxPopulation = Math.max(existing.maxPopulation, entry.maxPopulation);
    }
  }
}

for (const { data } of sources) {
  addEntries(data.entries || {});
}

// Convert to JSON
const entries = {};
let totalPairs = 0;
for (const [thai, entry] of merged) {
  const variants = {};
  for (const [latin, count] of entry.variants) {
    variants[latin] = count;
    totalPairs++;
  }
  entries[thai] = {
    variants,
    featureClasses: [...entry.featureClasses],
    maxPopulation: entry.maxPopulation,
  };
}

const sourceCounts = {};
for (const { name, entryCount } of sources) {
  sourceCounts[`${name}Names`] = entryCount;
}

const output = {
  metadata: {
    sources: sources.map(s => s.name),
    mergedAt: new Date().toISOString(),
    uniqueThaiNames: merged.size,
    totalPairs,
    ...sourceCounts,
  },
  entries,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.error(`\nMerged registry written to ${outputPath}`);
console.error(`  Sources: ${sources.map(s => s.name).join(', ')}`);
console.error(`  Unique Thai names: ${merged.size}`);
console.error(`  Total unique pairs: ${totalPairs}`);
