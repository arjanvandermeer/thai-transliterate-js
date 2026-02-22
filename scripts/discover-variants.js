#!/usr/bin/env node
/**
 * Discover new romanization variants missing from the base tables by analyzing
 * close-but-not-exact matches in the GeoNames/OSM registry.
 *
 * For close matches (distance 1-5), the registry variant differs from the best
 * algorithmic output at typically 1-2 positions. A wildcard-aware decomposition
 * identifies the novel romanization at each position.
 *
 * Usage: node scripts/discover-variants.js
 *   [--input data/registry.json]
 *   [--output data/variant-discoveries.json]
 *   [--min-observations 5]
 *   [--max-distance 5]
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

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}

const inputPath = argValue('--input', join(root, 'data', 'registry.json'));
const outputPath = argValue('--output', join(root, 'data', 'variant-discoveries.json'));
const minObservations = parseInt(argValue('--min-observations', '5'), 10);
const maxDistance = parseInt(argValue('--max-distance', '5'), 10);

// Thai word segmenter
let segmenter = null;
try {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  }
} catch { /* unavailable */ }

function segmentWords(thai) {
  if (segmenter) {
    return [...segmenter.segment(thai)]
      .filter(seg => seg.isWordLike)
      .map(seg => seg.segment);
  }
  return thai.split(/\s+/).filter(Boolean);
}

/**
 * Pure algorithmic transliteration for a single Thai word (no dictionary).
 */
function algorithmicVariants(word) {
  const syllables = parseSyllables(word);
  const positions = syllables.map(syl => romanizeSyllable(syl));
  return generateVariants(positions, { maxVariants: 15 });
}

/**
 * Find best algorithmic variant for a target string.
 */
function bestAlgoMatch(variants, target) {
  const targetLower = target.toLowerCase();
  let best = null;
  let bestDist = Infinity;
  for (const v of variants) {
    const dist = levenshtein(v.text.toLowerCase(), targetLower);
    if (dist < bestDist) {
      bestDist = dist;
      best = v;
    }
  }
  return { variant: best, distance: bestDist };
}

// --- Wildcard decomposition ---

function inferPositionType(posIdx, positions, syllable) {
  if (syllable.flags.thorSo || syllable.flags.sorRo) {
    if (posIdx === 0) return 'cluster_special';
    if (posIdx === 1) return 'vowel';
    return 'final';
  }
  let idx = 0;
  if (posIdx === idx) return 'initial';
  idx++;
  if (syllable.clusterConsonant) {
    if (posIdx === idx) return 'cluster';
    idx++;
  }
  if (posIdx === idx) return 'vowel';
  return 'final';
}

function getPositionKey(posType, syllable) {
  if (posType === 'initial') return syllable.initialConsonant;
  if (posType === 'final') return syllable.finalConsonant;
  if (posType === 'vowel') return syllable.vowelPattern;
  if (posType === 'cluster_special') {
    return syllable.flags.thorSo ? 'ทร' : syllable.flags.sorRo ? 'ศร' : null;
  }
  if (posType === 'cluster') {
    return syllable.initialConsonant + syllable.clusterConsonant;
  }
  return null;
}

/**
 * Wildcard-aware decomposition. Returns observations or null if ambiguous.
 * Max 1 wildcard per syllable.
 */
function wildcardDecompose(registryText, thaiWord) {
  const syllables = parseSyllables(thaiWord);
  const observations = [];
  let remaining = registryText.toLowerCase();

  for (const syllable of syllables) {
    if (syllable.passthrough) {
      if (remaining.startsWith(syllable.raw.toLowerCase())) {
        remaining = remaining.slice(syllable.raw.length);
      }
      continue;
    }

    const positions = romanizeSyllable(syllable);
    let wildcardUsed = false;

    for (let p = 0; p < positions.length; p++) {
      const variants = positions[p];
      const posType = inferPositionType(p, positions, syllable);
      const key = getPositionKey(posType, syllable);

      // Try known variants (longest-first)
      const sorted = [...variants].sort((a, b) => b.text.length - a.text.length);
      let matched = false;

      for (const v of sorted) {
        if (remaining.startsWith(v.text.toLowerCase())) {
          observations.push({ posType, key, text: v.text, isKnown: true });
          remaining = remaining.slice(v.text.length);
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // No known variant matches — try wildcard
      if (wildcardUsed) return null; // Too ambiguous

      // Find anchor from next positions
      const anchors = collectAnchors(positions, p + 1, syllable, syllables);
      let candidateText = null;

      if (anchors.length === 0) {
        // Last position — wildcard text is all remaining
        candidateText = remaining;
      } else {
        // Try each anchor, find shortest valid wildcard
        for (const anchor of anchors) {
          const anchorText = anchor.toLowerCase();
          if (anchorText.length === 0) continue;
          const idx = remaining.indexOf(anchorText);
          if (idx > 0 && (candidateText === null || idx < candidateText.length)) {
            candidateText = remaining.slice(0, idx);
          }
        }
      }

      if (candidateText === null || candidateText.length === 0 ||
          candidateText.length > 6 || !/^[a-z]+$/.test(candidateText)) {
        return null;
      }

      observations.push({ posType, key, text: candidateText, isKnown: false });
      remaining = remaining.slice(candidateText.length);
      wildcardUsed = true;
    }
  }

  if (remaining.trim().length > 0) return null;
  return observations;
}

/**
 * Collect anchor texts from subsequent positions.
 */
function collectAnchors(currentPositions, startPos, currentSyllable, allSyllables) {
  const anchors = [];

  // Remaining positions in current syllable
  for (let p = startPos; p < currentPositions.length; p++) {
    for (const v of currentPositions[p]) {
      if (v.text.length > 0) anchors.push(v.text);
    }
    if (anchors.length > 0) return anchors;
  }

  // First position of next syllables
  const sylIdx = allSyllables.indexOf(currentSyllable);
  for (let s = sylIdx + 1; s < allSyllables.length; s++) {
    const syl = allSyllables[s];
    if (syl.passthrough) continue;
    const positions = romanizeSyllable(syl);
    if (positions.length > 0) {
      for (const v of positions[0]) {
        if (v.text.length > 0) anchors.push(v.text);
      }
      if (anchors.length > 0) return anchors;
    }
  }

  return anchors;
}

// --- Main ---

const registry = JSON.parse(readFileSync(inputPath, 'utf-8'));
const entries = Object.entries(registry.entries);
console.error(`Discovering variants from ${entries.length} entries (maxDistance: ${maxDistance})`);

// Discovery aggregation
const discoveries = {};

function recordDiscovery(posType, key, text, thai, registryVariant, count) {
  if (!key) return;
  const bucket = `${posType}|${key}|${text}`;
  if (!discoveries[bucket]) {
    discoveries[bucket] = { posType, key, text, count: 0, examples: [] };
  }
  const entry = discoveries[bucket];
  entry.count += count;
  if (entry.examples.length < 5) {
    entry.examples.push({ thai, registry: registryVariant, count });
  }
}

const startTime = Date.now();
let closeMatchCount = 0;
let decompAttempts = 0;
let decompSuccesses = 0;
let novelCount = 0;

for (let i = 0; i < entries.length; i++) {
  if (i > 0 && i % 20000 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stderr.write(`  ${i}/${entries.length} (${elapsed}s) close=${closeMatchCount} novel=${novelCount}\r`);
  }

  const [thai, regEntry] = entries[i];
  const { variants: realWorldVariants } = regEntry;

  // Segment into words and generate algorithmic variants per word
  const words = segmentWords(thai);

  // For single-word entries (most common), generate variants once
  let algoVariants;
  if (words.length === 1) {
    algoVariants = algorithmicVariants(words[0]);
  } else {
    // Multi-word: combine variants (simplified — just concatenate top variants)
    const perWord = words.map(w => algorithmicVariants(w));
    let combined = perWord[0].map(v => ({ text: v.text.toLowerCase(), weight: v.weight }));
    for (let w = 1; w < perWord.length; w++) {
      const next = [];
      for (const acc of combined.slice(0, 5)) {
        for (const v of perWord[w].slice(0, 5)) {
          next.push({ text: acc.text + v.text.toLowerCase(), weight: acc.weight * v.weight });
        }
      }
      combined = next.sort((a, b) => b.weight - a.weight).slice(0, 15);
    }
    algoVariants = combined;
  }

  if (algoVariants.length === 0) continue;

  for (const [target, count] of Object.entries(realWorldVariants)) {
    if (count < 1) continue;
    const targetClean = target.toLowerCase().replace(/[^a-z ]/g, '').trim();
    if (targetClean.length < 2) continue;

    const { distance } = bestAlgoMatch(algoVariants, targetClean);
    if (distance === 0 || distance > maxDistance) continue;

    closeMatchCount++;

    // Attempt wildcard decomposition on the registry variant
    decompAttempts++;

    // For single-word, decompose against the word directly
    // For multi-word, decompose against full Thai text
    const decompTarget = words.length === 1 ? words[0] : thai;
    const obs = wildcardDecompose(targetClean, decompTarget);

    if (!obs) continue;
    decompSuccesses++;

    for (const o of obs) {
      if (!o.isKnown) {
        novelCount++;
        recordDiscovery(o.posType, o.key, o.text, thai, target, count);
      }
    }
  }
}

process.stderr.write('\n');

// Build filtered output
const discoveryList = Object.values(discoveries)
  .filter(d => d.count >= minObservations)
  .sort((a, b) => b.count - a.count);

// Compute suggested weights
for (const disc of discoveryList) {
  // Count all observations at this position (both known and novel)
  const posKey = `${disc.posType}|${disc.key}`;
  let totalAtPosition = disc.count;
  for (const d of Object.values(discoveries)) {
    if (`${d.posType}|${d.key}` === posKey && d.text !== disc.text) {
      totalAtPosition += d.count;
    }
  }
  const frequency = disc.count / Math.max(1, totalAtPosition);
  disc.frequency = Math.round(frequency * 1000) / 1000;
  disc.suggestedWeight = Math.round(Math.min(0.8, frequency) * 100) / 100;
}

const output = {
  metadata: {
    generatedAt: new Date().toISOString(),
    description: 'Discovered romanization variants not in base tables. Regenerate: npm run calibrate:discover',
    totalEntries: entries.length,
    closeMatchesAnalyzed: closeMatchCount,
    decompositionAttempts: decompAttempts,
    decompositionSuccesses: decompSuccesses,
    novelObservations: novelCount,
    uniqueDiscoveries: discoveryList.length,
    minObservations,
    maxDistance,
  },
  discoveries: discoveryList,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
console.error(`\nDiscovery written to ${outputPath}`);
console.error(`  Close matches analyzed: ${closeMatchCount}`);
console.error(`  Decompositions: ${decompSuccesses}/${decompAttempts} (${(decompSuccesses / Math.max(1, decompAttempts) * 100).toFixed(1)}%)`);
console.error(`  Novel observations: ${novelCount}`);
console.error(`  Unique discoveries (>= ${minObservations} obs): ${discoveryList.length}`);
console.error(`  Elapsed: ${elapsed}s`);

if (discoveryList.length > 0) {
  console.error(`\nTop discoveries:`);
  for (const d of discoveryList.slice(0, 20)) {
    const ex = d.examples[0];
    console.error(`  ${d.count} obs: ${d.posType} ${d.key} → "${d.text}" (w=${d.suggestedWeight}) e.g. ${ex.thai}→${ex.registry}`);
  }
}
