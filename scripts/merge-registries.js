#!/usr/bin/env node
/**
 * Merge GeoNames and OSM registries into a single unified registry.
 *
 * Usage: node scripts/merge-registries.js
 *   [--geonames data/registry-geonames.json]
 *   [--osm data/registry-osm.json]
 *   [--output data/registry.json]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}
const geonamesPath = argValue('--geonames', join(root, 'data', 'registry-geonames.json'));
const osmPath = argValue('--osm', join(root, 'data', 'registry-osm.json'));
const outputPath = argValue('--output', join(root, 'data', 'registry.json'));

// Load registries (either or both may exist)
let geonames = null;
let osm = null;

if (existsSync(geonamesPath)) {
  geonames = JSON.parse(readFileSync(geonamesPath, 'utf-8'));
  console.error(`Loaded GeoNames: ${Object.keys(geonames.entries).length} Thai names`);
}

if (existsSync(osmPath)) {
  osm = JSON.parse(readFileSync(osmPath, 'utf-8'));
  console.error(`Loaded OSM: ${Object.keys(osm.entries).length} Thai names`);
}

if (!geonames && !osm) {
  console.error('No registry files found. Run extract-geonames.js and/or extract-osm.js first.');
  process.exit(1);
}

// Merge into unified registry
const merged = new Map();

function addEntries(source, sourceEntries) {
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

if (geonames) addEntries('geonames', geonames.entries);
if (osm) addEntries('osm', osm.entries);

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

const output = {
  metadata: {
    sources: [
      geonames && 'geonames',
      osm && 'osm',
    ].filter(Boolean),
    mergedAt: new Date().toISOString(),
    uniqueThaiNames: merged.size,
    totalPairs,
    geonamesNames: geonames ? Object.keys(geonames.entries).length : 0,
    osmNames: osm ? Object.keys(osm.entries).length : 0,
  },
  entries,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.error(`\nMerged registry written to ${outputPath}`);
console.error(`  Unique Thai names: ${merged.size}`);
console.error(`  Total unique pairs: ${totalPairs}`);
