#!/usr/bin/env node
/**
 * Analyze dictionary.json gaps to understand WHY the algorithm fails.
 * Categorizes each gap entry by root cause to guide algorithmic improvements.
 *
 * Usage: node scripts/analyze-dictionary-gaps.js
 *   [--input src/tables/dictionary.json]
 *   [--output data/dictionary-gap-analysis.json]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyChar } from '../src/classifier.js';
import { parseSyllables } from '../src/syllable-parser.js';
import { levenshtein } from '../src/levenshtein.js';
import { argValue } from './lib/args.js';
import { segmentWords, algorithmicVariantsWord } from './lib/algorithmic.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const inputPath = argValue('--input', join(root, 'src', 'tables', 'dictionary.json'));
const outputPath = argValue('--output', join(root, 'data', 'dictionary-gap-analysis.json'));

const dict = JSON.parse(readFileSync(inputPath, 'utf-8'));
const TONE_CHARS = new Set(['\u0E48', '\u0E49', '\u0E4A', '\u0E4B']);

/**
 * Get pure algorithmic top variants for a Thai word/phrase (no dictionary).
 */
function algorithmicTop(thai, maxVariants = 20) {
  const words = segmentWords(thai);
  const perWord = words.map(word => algorithmicVariantsWord(word, 15));

  if (perWord.length === 1) return perWord[0];

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
 * Check if Thai text contains tone marks.
 */
function hasToneMarks(thai) {
  for (const ch of thai) {
    if (TONE_CHARS.has(ch)) return true;
  }
  return false;
}

/**
 * Strip tone marks from Thai text.
 */
function stripToneMarks(thai) {
  return [...thai].filter(ch => !TONE_CHARS.has(ch)).join('');
}

/**
 * Analyze a single dictionary gap entry.
 */
function analyzeEntry(thai, dictVariants) {
  const dictTop1 = dictVariants[0].text.toLowerCase();
  const algoVariants = algorithmicTop(thai);
  const algoTop1 = algoVariants.length > 0 ? algoVariants[0].text.toLowerCase() : '';
  const algoTexts = new Set(algoVariants.map(v => v.text.toLowerCase()));

  // Check if algorithm already produces the dictionary variant
  if (algoTexts.has(dictTop1)) {
    const rank = algoVariants.findIndex(v => v.text.toLowerCase() === dictTop1) + 1;
    return {
      thai, dictTop1, algoTop1,
      status: rank === 1 ? 'COVERED' : 'RERANKING',
      algoRank: rank,
      bestDist: 0,
      rootCauses: [],
    };
  }

  // Find closest algorithmic variant
  let bestDist = Infinity;
  let bestAlgo = algoTop1;
  for (const v of algoVariants) {
    const dist = levenshtein(v.text.toLowerCase(), dictTop1);
    if (dist < bestDist) {
      bestDist = dist;
      bestAlgo = v.text.toLowerCase();
    }
  }

  // Root cause analysis
  const rootCauses = [];
  const containsTone = hasToneMarks(thai);

  // Check tone mark impact: strip tones, re-run, see if result improves
  if (containsTone) {
    const stripped = stripToneMarks(thai);
    const strippedVariants = algorithmicTop(stripped);
    const strippedTexts = new Set(strippedVariants.map(v => v.text.toLowerCase()));

    if (strippedTexts.has(dictTop1)) {
      rootCauses.push('TONE_MARK');
    } else {
      // Even without tone, check if stripping improves distance
      let bestStrippedDist = Infinity;
      for (const v of strippedVariants) {
        const dist = levenshtein(v.text.toLowerCase(), dictTop1);
        if (dist < bestStrippedDist) bestStrippedDist = dist;
      }
      if (bestStrippedDist < bestDist) {
        rootCauses.push('TONE_MARK_PARTIAL');
      }
    }
  }

  // Check syllable count mismatch
  try {
    const words = segmentWords(thai);
    for (const word of words) {
      const syllables = parseSyllables(word);
      const nonPassthrough = syllables.filter(s => !s.passthrough);
      // Count implied vowels — high count suggests parsing issues
      const impliedCount = nonPassthrough.filter(s => s.isImpliedVowel).length;
      if (impliedCount > nonPassthrough.length * 0.5 && nonPassthrough.length > 1) {
        rootCauses.push('EXCESS_IMPLIED_VOWELS');
      }
    }
  } catch { /* ignore parse errors */ }

  // Categorize by distance
  const distRatio = dictTop1.length > 0 ? bestDist / dictTop1.length : 1;
  if (distRatio <= 0.15) {
    rootCauses.push('MINOR_SPELLING');
  } else if (distRatio <= 0.3) {
    rootCauses.push('MODERATE_DIFFERENCE');
  } else {
    rootCauses.push('MAJOR_DIFFERENCE');
  }

  // If no specific root cause found and it's close, mark as WEIGHT_TOO_LOW
  if (rootCauses.length === 1 && bestDist <= 2) {
    rootCauses.push('WEIGHT_TOO_LOW');
  }

  return {
    thai, dictTop1, algoTop1,
    status: 'GAP',
    bestDist,
    bestAlgo,
    distRatio: parseFloat(distRatio.toFixed(3)),
    rootCauses,
  };
}

// --- Main ---

const entries = Object.entries(dict.entries);
const startTime = Date.now();
const results = [];
const stats = {
  total: entries.length,
  covered: 0,
  reranking: 0,
  gap: 0,
};
const rootCauseCounts = {};
const toneMarkStats = { total: 0, toneMark: 0, toneMarkPartial: 0 };

for (let i = 0; i < entries.length; i++) {
  if (i > 0 && i % 500 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stderr.write(`  ${i}/${entries.length} (${elapsed}s)\r`);
  }

  const [thai, variants] = entries[i];
  const analysis = analyzeEntry(thai, variants);
  results.push(analysis);

  if (analysis.status === 'COVERED') stats.covered++;
  else if (analysis.status === 'RERANKING') stats.reranking++;
  else stats.gap++;

  for (const cause of analysis.rootCauses) {
    rootCauseCounts[cause] = (rootCauseCounts[cause] || 0) + 1;
  }

  if (hasToneMarks(thai)) toneMarkStats.total++;
  if (analysis.rootCauses.includes('TONE_MARK')) toneMarkStats.toneMark++;
  if (analysis.rootCauses.includes('TONE_MARK_PARTIAL')) toneMarkStats.toneMarkPartial++;
}

process.stderr.write('\n');
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// Sort root causes by count
const sortedCauses = Object.entries(rootCauseCounts).sort((a, b) => b[1] - a[1]);

// Distance distribution for gaps
const distBuckets = { 0: 0, 1: 0, 2: 0, '3-5': 0, '6-10': 0, '11+': 0 };
for (const r of results) {
  if (r.status !== 'GAP') continue;
  if (r.bestDist === 0) distBuckets[0]++;
  else if (r.bestDist === 1) distBuckets[1]++;
  else if (r.bestDist === 2) distBuckets[2]++;
  else if (r.bestDist <= 5) distBuckets['3-5']++;
  else if (r.bestDist <= 10) distBuckets['6-10']++;
  else distBuckets['11+']++;
}

// Console output
console.error(`\nDictionary Gap Analysis (${elapsed}s)`);
console.error(`${'='.repeat(50)}`);
console.error(`  Total entries:      ${stats.total}`);
console.error(`  Already covered:    ${stats.covered.toString().padStart(5)}  (${(stats.covered / stats.total * 100).toFixed(1)}%)`);
console.error(`  Reranking only:     ${stats.reranking.toString().padStart(5)}  (${(stats.reranking / stats.total * 100).toFixed(1)}%)`);
console.error(`  True gaps:          ${stats.gap.toString().padStart(5)}  (${(stats.gap / stats.total * 100).toFixed(1)}%)`);

console.error(`\n  Tone mark analysis:`);
console.error(`    Entries with tones:     ${toneMarkStats.total}`);
console.error(`    Fixed by tone fix:      ${toneMarkStats.toneMark}  (${(toneMarkStats.toneMark / stats.total * 100).toFixed(1)}% of total)`);
console.error(`    Partially improved:     ${toneMarkStats.toneMarkPartial}`);

console.error(`\n  Root causes (entries can have multiple):`);
for (const [cause, count] of sortedCauses) {
  console.error(`    ${cause.padEnd(25)} ${count.toString().padStart(5)}  (${(count / stats.total * 100).toFixed(1)}%)`);
}

console.error(`\n  Distance distribution (gaps only):`);
for (const [bucket, count] of Object.entries(distBuckets)) {
  if (count > 0) console.error(`    dist=${bucket}: ${count}`);
}

// Estimate reduction from tone fix alone
const toneFixable = toneMarkStats.toneMark;
const estimatedAfterFix = stats.total - stats.covered - stats.reranking - toneFixable;
console.error(`\n  Estimated after tone fix: ~${estimatedAfterFix} remaining gaps (${(toneFixable / stats.total * 100).toFixed(1)}% reduction)`);

// Write detailed output
const output = {
  _meta: {
    generatedAt: new Date().toISOString(),
    totalEntries: stats.total,
    stats,
    toneMarkStats,
    rootCauseCounts: Object.fromEntries(sortedCauses),
    distBuckets,
    elapsed: parseFloat(elapsed),
  },
  entries: results,
};
writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.error(`\n  Written to ${outputPath}`);
