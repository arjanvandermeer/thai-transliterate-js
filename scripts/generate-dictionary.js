#!/usr/bin/env node
/**
 * Generate a dictionary of known Thai↔Latin transliterations from the merged registry.
 * Filters out translations (Bangkok, Thailand) — only includes actual transliterations.
 *
 * Usage: node scripts/generate-dictionary.js
 *   [--input data/registry.json]
 *   [--output src/tables/dictionary.json]
 *   [--max-entries 20000]
 *   [--min-count 3]
 *   [--max-variants 5]
 *   [--max-distance-ratio 0.4]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { levenshtein } from '../src/levenshtein.js';

import { argValue } from './lib/args.js';
import { algorithmicVariantsText } from './lib/algorithmic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const inputPath = argValue('--input', join(root, 'data', 'registry.json'));
const outputPath = argValue('--output', join(root, 'src', 'tables', 'dictionary.json'));
const maxEntries = parseInt(argValue('--max-entries', '20000'), 10);
const minCount = parseInt(argValue('--min-count', '3'), 10);
const maxVariantsPerEntry = parseInt(argValue('--max-variants', '5'), 10);
const maxDistanceRatio = parseFloat(argValue('--max-distance-ratio', '0.4'));

/** @type {(thai: string) => string[]} */
const algorithmicVariants = algorithmicVariantsText;

/**
 * Check if a Latin variant is a transliteration (not a translation) of the Thai text.
 * Returns true if the variant is phonetically close to any algorithmic output.
 */
function isTransliteration(variant, algoVariants) {
  const normalized = variant.toLowerCase().trim();
  if (normalized.length < 2) return false;

  let minDist = Infinity;
  for (const algo of algoVariants) {
    const dist = levenshtein(normalized, algo);
    if (dist < minDist) minDist = dist;
    if (dist === 0) return true; // exact match — definitely a transliteration
  }

  // Allow up to maxDistanceRatio of the variant length
  return minDist / normalized.length <= maxDistanceRatio;
}

// Load registry
const registry = JSON.parse(readFileSync(inputPath, 'utf-8'));
const entries = Object.entries(registry.entries);
console.error(`Loaded registry: ${entries.length} Thai names`);

// Score and filter entries
const scored = [];

for (const [thai, entry] of entries) {
  const variants = Object.entries(entry.variants);
  const totalCount = variants.reduce((sum, [, count]) => sum + count, 0);

  if (totalCount < minCount) continue;

  // Score: observations + population bonus
  const score = totalCount + (entry.maxPopulation || 0) / 100;

  scored.push({ thai, variants, totalCount, maxPopulation: entry.maxPopulation || 0, score });
}

console.error(`Entries with >= ${minCount} observations: ${scored.length}`);

// Sort by score descending, take top entries
scored.sort((a, b) => b.score - a.score);
const selected = scored.slice(0, maxEntries);

console.error(`Selected top ${selected.length} entries`);
console.error(`Filtering to transliterations only (max distance ratio: ${maxDistanceRatio})...`);

/**
 * Confidence-based weight ceiling.
 * More real-world observations → higher ceiling → dictionary outranks algorithm.
 */
function confidenceCeiling(totalCount) {
  if (totalCount >= 10) return 1.1;
  if (totalCount >= 5) return 1.05;
  return 0.9;
}

// Build dictionary with transliteration filter
const dictEntries = {};
let filteredVariants = 0;
let keptVariants = 0;
let skippedEntries = 0;
const startTime = Date.now();

for (let i = 0; i < selected.length; i++) {
  if (i > 0 && i % 5000 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stderr.write(`  ${i}/${selected.length} (${elapsed}s) kept=${keptVariants} filtered=${filteredVariants}\r`);
  }

  const entry = selected[i];

  // Get algorithmic transliterations for this Thai text
  const algoVars = algorithmicVariants(entry.thai);

  // Sort variants by count descending
  const sorted = entry.variants.sort((a, b) => b[1] - a[1]);

  // Filter to transliterations only
  const transliterations = [];
  for (const [text, count] of sorted) {
    if (isTransliteration(text, algoVars)) {
      transliterations.push([text, count]);
      keptVariants++;
    } else {
      filteredVariants++;
    }
    if (transliterations.length >= maxVariantsPerEntry) break;
  }

  if (transliterations.length === 0) {
    skippedEntries++;
    continue;
  }

  const maxCount = transliterations[0][1];
  const totalFiltered = transliterations.reduce((sum, [, c]) => sum + c, 0);
  const ceiling = confidenceCeiling(totalFiltered);
  dictEntries[entry.thai] = transliterations.map(([text, count]) => ({
    text: text.toLowerCase(),
    weight: Math.round(Math.max(0.1, (count / maxCount) * ceiling) * 100) / 100,
    count,
  }));
}

process.stderr.write('\n');

const output = {
  _meta: {
    generatedAt: new Date().toISOString(),
    description: 'Known Thai↔Latin transliterations from GeoNames/OSM. Regenerate: npm run calibrate:dictionary',
    totalEntries: Object.keys(dictEntries).length,
    sources: registry.metadata.sources,
    filters: { minCount, maxEntries, maxVariantsPerEntry, maxDistanceRatio },
  },
  entries: dictEntries,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.error(`\nDictionary written to ${outputPath}`);
console.error(`  Entries: ${Object.keys(dictEntries).length} (${skippedEntries} entries had no transliterations)`);
console.error(`  Variants kept: ${keptVariants}, filtered: ${filteredVariants}`);
console.error(`  File size: ${(Buffer.byteLength(JSON.stringify(output, null, 2)) / 1024 / 1024).toFixed(1)}MB`);
console.error(`  Elapsed: ${elapsed}s`);
