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
import { parseSyllables } from '../src/syllable-parser.js';
import { romanizeSyllable } from '../src/romanizer.js';
import { generateVariants } from '../src/variant-generator.js';
import { levenshtein } from '../src/levenshtein.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}

const inputPath = argValue('--input', join(root, 'data', 'registry.json'));
const outputPath = argValue('--output', join(root, 'src', 'tables', 'dictionary.json'));
const maxEntries = parseInt(argValue('--max-entries', '20000'), 10);
const minCount = parseInt(argValue('--min-count', '3'), 10);
const maxVariantsPerEntry = parseInt(argValue('--max-variants', '5'), 10);
const maxDistanceRatio = parseFloat(argValue('--max-distance-ratio', '0.4'));

// Thai word segmenter
let segmenter = null;
try {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  }
} catch { /* unavailable */ }

/**
 * Pure algorithmic transliteration (no dictionary lookup).
 * Returns lowercase variant texts for distance comparison.
 */
function algorithmicVariants(thai) {
  // Segment into words first
  let words;
  if (segmenter) {
    words = [...segmenter.segment(thai)]
      .filter(seg => seg.isWordLike)
      .map(seg => seg.segment);
  } else {
    words = [thai];
  }

  // Generate variants per word, combine
  const perWord = words.map(word => {
    const syllables = parseSyllables(word);
    const positions = syllables.map(syl => romanizeSyllable(syl));
    return generateVariants(positions, { maxVariants: 15 });
  });

  if (perWord.length === 1) {
    return perWord[0].map(v => v.text.toLowerCase());
  }

  // Combine across words (simplified — just concatenate top variants)
  let combined = perWord[0].map(v => v.text.toLowerCase());
  for (let i = 1; i < perWord.length; i++) {
    const next = [];
    for (const acc of combined) {
      for (const v of perWord[i]) {
        next.push(acc + v.text.toLowerCase());
        next.push(acc + ' ' + v.text.toLowerCase());
      }
    }
    combined = next.slice(0, 50); // cap to prevent explosion
  }
  return combined;
}

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
  dictEntries[entry.thai] = transliterations.map(([text, count]) => ({
    text,
    weight: Math.round(Math.max(0.1, (count / maxCount) * 0.95) * 100) / 100,
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
