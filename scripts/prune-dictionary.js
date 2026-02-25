#!/usr/bin/env node
/**
 * Prune dictionary.json by removing entries where the algorithm already
 * produces the correct top-1 variant. Generates a gap analysis report
 * for entries where the algorithm falls short.
 *
 * Usage: node scripts/prune-dictionary.js
 *   [--input src/tables/dictionary.json]
 *   [--output src/tables/dictionary.json]
 *   [--gaps data/dictionary-gaps.json]
 *   [--dry-run]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSyllables } from '../src/syllable-parser.js';
import { romanizeSyllable } from '../src/romanizer.js';
import { levenshtein } from '../src/levenshtein.js';

import { argValue, hasFlag } from './lib/args.js';
import { segmentWords, algorithmicVariantsWord } from './lib/algorithmic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const inputPath = argValue('--input', join(root, 'src', 'tables', 'dictionary.json'));
const outputPath = argValue('--output', inputPath);
const gapsPath = argValue('--gaps', join(root, 'data', 'dictionary-gaps.json'));
const dryRun = hasFlag('--dry-run');

// Load dictionaries
const dict = JSON.parse(readFileSync(inputPath, 'utf-8'));

let manualKeys = new Set();
try {
  const manual = JSON.parse(readFileSync(join(root, 'src', 'tables', 'dictionary-manual.json'), 'utf-8'));
  manualKeys = new Set(Object.keys(manual.entries || {}));
} catch { /* no manual dictionary */ }

/**
 * Pure algorithmic top variants for a Thai word/phrase.
 * Segments multi-word input and combines per-word results.
 * Returns variant objects (not just lowercase strings).
 */
function algorithmicTop(thai, maxVariants = 20) {
  const words = segmentWords(thai);
  const perWord = words.map(word => algorithmicVariantsWord(word, 15));

  if (perWord.length === 1) return perWord[0];

  // Combine across words
  let combined = perWord[0].map(v => ({ text: v.text, weight: v.weight }));
  for (let i = 1; i < perWord.length; i++) {
    const next = [];
    for (const acc of combined) {
      for (const v of perWord[i]) {
        const weight = acc.weight * v.weight;
        if (weight >= 0.01) {
          next.push({ text: acc.text + v.text, weight });
          next.push({ text: acc.text + ' ' + v.text, weight });
        }
      }
    }
    next.sort((a, b) => b.weight - a.weight);
    combined = next.slice(0, 50);
  }

  // Dedup
  const map = new Map();
  for (const v of combined) {
    const key = v.text.toLowerCase();
    const existing = map.get(key);
    if (!existing || v.weight > existing.weight) {
      map.set(key, v);
    }
  }
  const result = [...map.values()];
  result.sort((a, b) => b.weight - a.weight);
  return result.slice(0, maxVariants);
}

/**
 * Classify a dictionary entry against pure algorithmic output.
 *
 * - redundant: algorithm top-1 matches dictionary top-1
 * - reranking: dictionary top-1 exists in algorithm variants (not #1)
 * - close_enough: an algorithm variant is within maxDistance of dictionary top-1
 * - gap: dictionary top-1 not close to any algorithm variant
 */
function classifyEntry(thai, dictVariants) {
  const algoVariants = algorithmicTop(thai);
  const dictTop1 = dictVariants[0].text.toLowerCase();
  const algoTop1 = algoVariants.length > 0 ? algoVariants[0].text.toLowerCase() : '';

  // Exact top-1 match
  if (algoTop1 === dictTop1) {
    return { classification: 'redundant', algoTop1, dictTop1 };
  }

  // Dictionary's answer exists in algorithm variants
  const algoTexts = new Set(algoVariants.map(v => v.text.toLowerCase()));
  if (algoTexts.has(dictTop1)) {
    const algoRank = algoVariants.findIndex(v => v.text.toLowerCase() === dictTop1) + 1;
    return { classification: 'reranking', algoTop1, dictTop1, algoRank };
  }

  // Check if any algorithm variant is close enough (distance <= 2)
  let bestDist = Infinity;
  let bestAlgo = algoTop1;
  for (const v of algoVariants) {
    const dist = levenshtein(v.text.toLowerCase(), dictTop1);
    if (dist < bestDist) {
      bestDist = dist;
      bestAlgo = v.text.toLowerCase();
    }
    if (dist === 0) break;
  }
  const maxDist = Math.max(2, Math.floor(dictTop1.length * 0.15));
  if (bestDist <= maxDist) {
    return { classification: 'close_enough', algoTop1, dictTop1, bestAlgo, bestDist };
  }

  return {
    classification: 'gap',
    algoTop1,
    dictTop1,
    algoVariants: algoVariants.slice(0, 5).map(v => v.text.toLowerCase()),
  };
}

/**
 * Analyze WHY the algorithm misses a dictionary entry.
 * Compares syllable-by-syllable between algorithm and dictionary outputs.
 */
function analyzeGap(thai, dictTop1, algoTop1) {
  const dist = levenshtein(algoTop1, dictTop1);
  const issues = [];

  // Syllable-level analysis
  try {
    const words = segmentWords(thai);
    for (const word of words) {
      const syllables = parseSyllables(word);
      for (const syl of syllables) {
        const positions = romanizeSyllable(syl);
        for (let i = 0; i < positions.length; i++) {
          const pos = positions[i];
          const posType = inferPositionType(i, positions, syl);
          const knownTexts = new Set(pos.map(v => v.text.toLowerCase()));

          // Check if the dictTop1 contains text not in any known variant
          // (simplified: flag positions with many variants as potential sources of error)
          if (pos.length >= 3) {
            issues.push({
              type: `high_variance_${posType}`,
              key: syl.initialConsonant || '?',
              variantCount: pos.length,
            });
          }
        }
      }
    }
  } catch { /* parsing can fail on unusual input */ }

  // Character-level distance category
  const ratio = algoTop1.length > 0 ? dist / algoTop1.length : 1;
  if (ratio <= 0.15) {
    issues.push({ type: 'minor_spelling', distance: dist });
  } else if (ratio <= 0.3) {
    issues.push({ type: 'moderate_difference', distance: dist });
  } else {
    issues.push({ type: 'major_difference', distance: dist });
  }

  return issues;
}

/**
 * Infer position type from index within a syllable's positions array.
 */
function inferPositionType(posIdx, positions, syllable) {
  if (syllable.flags?.thorSo || syllable.flags?.sorRo) {
    if (posIdx === 0) return 'cluster_special';
    if (posIdx === 1) return 'vowel';
    return 'final';
  }
  let idx = 0;
  if (posIdx === idx) return 'initial';
  idx++;
  if (syllable.clusterConsonant) { if (posIdx === idx) return 'cluster'; idx++; }
  if (posIdx === idx) return 'vowel';
  return 'final';
}

// --- Main ---

const entries = Object.entries(dict.entries);
const stats = { total: entries.length, redundant: 0, reranking: 0, closeEnough: 0, gap: 0, manualSkipped: 0 };
const prunedEntries = {};
const gaps = [];
const rerankings = [];
const closeEnoughs = [];
const gapCategories = {};

const startTime = Date.now();

for (let i = 0; i < entries.length; i++) {
  if (i > 0 && i % 2000 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stderr.write(`  ${i}/${entries.length} (${elapsed}s) redundant=${stats.redundant} gap=${stats.gap}\r`);
  }

  const [thai, variants] = entries[i];

  // Never prune entries that overlap with manual dictionary
  if (manualKeys.has(thai)) {
    prunedEntries[thai] = variants;
    stats.manualSkipped++;
    continue;
  }

  const result = classifyEntry(thai, variants);

  if (result.classification === 'redundant') {
    stats.redundant++;
    continue;
  }

  if (result.classification === 'reranking') {
    stats.reranking++;
    rerankings.push({ thai, algoTop1: result.algoTop1, dictTop1: result.dictTop1, algoRank: result.algoRank });
    // Algorithm already produces the right answer — prune
    continue;
  }

  if (result.classification === 'close_enough') {
    stats.closeEnough++;
    closeEnoughs.push({ thai, algoTop1: result.algoTop1, dictTop1: result.dictTop1, bestAlgo: result.bestAlgo, bestDist: result.bestDist });
    // Algorithm has a variant close enough — prune
    continue;
  }

  // Gap — keep in dictionary and analyze
  stats.gap++;
  const issues = analyzeGap(thai, result.dictTop1, result.algoTop1);
  gaps.push({
    thai,
    dictTop1: result.dictTop1,
    algoTop1: result.algoTop1,
    algoVariants: result.algoVariants,
    issues,
  });

  for (const issue of issues) {
    gapCategories[issue.type] = (gapCategories[issue.type] || 0) + 1;
  }

  prunedEntries[thai] = variants;
}

process.stderr.write('\n');

// Sort gap categories by count
const sortedCategories = Object.entries(gapCategories).sort((a, b) => b[1] - a[1]);

// Stats output
const prunedCount = Object.keys(prunedEntries).length;
const reductionPct = ((1 - prunedCount / stats.total) * 100).toFixed(1);
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

const removed = stats.redundant + stats.reranking + stats.closeEnough;
console.error(`\nDictionary pruning (${elapsed}s):`);
console.error(`  Total entries:        ${stats.total}`);
console.error(`  Manual (skipped):     ${stats.manualSkipped}`);
console.error(`  Redundant (removed):  ${stats.redundant.toString().padStart(5)}  (${((stats.redundant / stats.total) * 100).toFixed(1)}%)`);
console.error(`  Reranking (removed):  ${stats.reranking.toString().padStart(5)}  (${((stats.reranking / stats.total) * 100).toFixed(1)}%)`);
console.error(`  Close enough (removed):${stats.closeEnough.toString().padStart(4)}  (${((stats.closeEnough / stats.total) * 100).toFixed(1)}%)`);
console.error(`  Gap (kept):           ${stats.gap.toString().padStart(5)}  (${((stats.gap / stats.total) * 100).toFixed(1)}%)`);
console.error(`\n  Pruned dictionary: ${prunedCount} entries (${reductionPct}% reduction, ${removed} removed)`);

if (sortedCategories.length > 0) {
  console.error(`\n  Top gap categories:`);
  for (const [type, count] of sortedCategories.slice(0, 10)) {
    console.error(`    ${type}: ${count}`);
  }
}

if (rerankings.length > 0) {
  console.error(`\n  Top reranking examples:`);
  for (const r of rerankings.slice(0, 5)) {
    console.error(`    ${r.thai}: algo="${r.algoTop1}" dict="${r.dictTop1}" (rank ${r.algoRank})`);
  }
}

if (closeEnoughs.length > 0) {
  console.error(`\n  Top close-enough examples:`);
  for (const c of closeEnoughs.slice(0, 5)) {
    console.error(`    ${c.thai}: algo="${c.bestAlgo}" dict="${c.dictTop1}" (dist ${c.bestDist})`);
  }
}

if (!dryRun) {
  // Write pruned dictionary
  const output = {
    _meta: {
      ...dict._meta,
      generatedAt: new Date().toISOString(),
      totalEntries: prunedCount,
      pruned: {
        originalEntries: stats.total,
        redundantRemoved: stats.redundant,
        rerankingRemoved: stats.reranking,
        closeEnoughRemoved: stats.closeEnough,
        gapEntries: stats.gap,
        reductionPercent: parseFloat(reductionPct),
      },
    },
    entries: prunedEntries,
  };
  writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
  console.error(`\n  Written to ${outputPath}`);

  // Write gap analysis
  const gapOutput = {
    _meta: {
      generatedAt: new Date().toISOString(),
      totalGaps: gaps.length,
      totalRerankings: rerankings.length,
      categories: Object.fromEntries(sortedCategories),
    },
    gaps,
    rerankings,
    closeEnoughs,
  };
  writeFileSync(gapsPath, JSON.stringify(gapOutput, null, 2) + '\n');
  console.error(`  Gap analysis written to ${gapsPath}`);
} else {
  console.error(`\n  --dry-run: no files written`);
}
