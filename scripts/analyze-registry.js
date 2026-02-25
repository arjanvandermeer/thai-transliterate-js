#!/usr/bin/env node
/**
 * Analyze the merged registry by running the transliterator against each entry.
 * Measures match quality and extracts weight evidence from exact matches.
 *
 * Usage: node scripts/analyze-registry.js [--input data/registry.json] [--output data/analysis.json]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchThai, transliterateWords } from '../src/index.js';
import { parseSyllables } from '../src/syllable-parser.js';
import { romanizeSyllable } from '../src/romanizer.js';
import { CONSONANTS, VOWEL_PATTERNS } from '../src/tables/load-weights.js';
import { argValue } from './lib/args.js';
import { inferPositionType } from './lib/position.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = argValue('--input', join(root, 'data', 'registry.json'));
const outputPath = argValue('--output', join(root, 'data', 'analysis.json'));
const maxVariants = parseInt(argValue('--max-variants', '30'), 10);

// Load registry
const registry = JSON.parse(readFileSync(inputPath, 'utf-8'));
const entries = Object.entries(registry.entries);
console.error(`Analyzing ${entries.length} Thai names (maxVariants: ${maxVariants})`);

// Quality classification
function classifyQuality(distance, targetLen) {
  if (distance === 0) return 'exact';
  if (distance <= 2) return 'close';
  // Scale threshold by target length for partial
  if (distance <= Math.max(5, Math.floor(targetLen * 0.3))) return 'partial';
  return 'miss';
}

// Weight evidence collection
const weightEvidence = {
  consonants: {},   // char → { initial: { text: count }, final: { text: count } }
  vowels: {},       // patternId → { text: count }
  clusters: {},     // clusterKey → { text: count }
};

/**
 * Given a matched text and syllable structure, determine which variant was
 * chosen at each position via greedy left-to-right matching.
 */
function decomposeMatch(matchedText, thaiWord) {
  const syllables = parseSyllables(thaiWord);
  const observations = [];
  let remaining = matchedText.toLowerCase();

  for (const syllable of syllables) {
    if (syllable.passthrough) {
      // Non-Thai — skip past it in the matched text
      if (remaining.startsWith(syllable.raw.toLowerCase())) {
        remaining = remaining.slice(syllable.raw.length);
      }
      continue;
    }

    const positions = romanizeSyllable(syllable);

    for (let p = 0; p < positions.length; p++) {
      const variants = positions[p];
      // Sort longest-first to avoid false prefix matches
      const sorted = [...variants].sort((a, b) => b.text.length - a.text.length);
      let matched = false;

      for (const v of sorted) {
        if (remaining.startsWith(v.text.toLowerCase())) {
          // Determine what this position represents
          const posType = inferPositionType(p, positions, syllable);
          observations.push({
            posType,
            syllable,
            chosenText: v.text,
            position: p,
          });
          remaining = remaining.slice(v.text.length);
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Can't decompose further — bail out of this syllable
        return observations;
      }
    }
  }

  return observations;
}

// inferPositionType imported from ./lib/position.js

/**
 * Record a decomposed observation in the weight evidence.
 */
function recordObservation(obs) {
  const { posType, syllable, chosenText } = obs;

  if (posType === 'initial') {
    const char = syllable.initialConsonant;
    if (!char) return;
    if (!weightEvidence.consonants[char]) weightEvidence.consonants[char] = { initial: {}, final: {} };
    const counts = weightEvidence.consonants[char].initial;
    counts[chosenText] = (counts[chosenText] || 0) + 1;
  } else if (posType === 'final') {
    const char = syllable.finalConsonant;
    if (!char) return;
    if (!weightEvidence.consonants[char]) weightEvidence.consonants[char] = { initial: {}, final: {} };
    const counts = weightEvidence.consonants[char].final;
    counts[chosenText] = (counts[chosenText] || 0) + 1;
  } else if (posType === 'vowel') {
    const patternId = syllable.vowelPattern;
    if (!patternId) return;
    if (!weightEvidence.vowels[patternId]) weightEvidence.vowels[patternId] = {};
    const counts = weightEvidence.vowels[patternId];
    counts[chosenText] = (counts[chosenText] || 0) + 1;
  } else if (posType === 'cluster_special') {
    // ทร or ศร cluster
    const key = syllable.flags.thorSo ? 'ทร' : syllable.flags.sorRo ? 'ศร' : null;
    if (!key) return;
    if (!weightEvidence.clusters[key]) weightEvidence.clusters[key] = {};
    const counts = weightEvidence.clusters[key];
    counts[chosenText] = (counts[chosenText] || 0) + 1;
  } else if (posType === 'cluster') {
    // Normal cluster second consonant (ร/ล/ว)
    const char = syllable.clusterConsonant;
    if (!char) return;
    const key = syllable.initialConsonant + char;
    if (!weightEvidence.clusters[key]) weightEvidence.clusters[key] = {};
    const counts = weightEvidence.clusters[key];
    counts[chosenText] = (counts[chosenText] || 0) + 1;
  }
}

// Analyze each entry
const analysisEntries = [];
let exactCount = 0;
let closeCount = 0;
let partialCount = 0;
let missCount = 0;
let popWeightedNum = 0;
let popWeightedDen = 0;
let decompositionCount = 0;

const startTime = Date.now();

for (let i = 0; i < entries.length; i++) {
  if (i > 0 && i % 10000 === 0) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const rate = (i / (Date.now() - startTime) * 1000).toFixed(0);
    process.stderr.write(`  ${i}/${entries.length} (${elapsed}s, ${rate}/s) exact=${exactCount} close=${closeCount}\r`);
  }

  const [thai, regEntry] = entries[i];
  const { variants: realWorldVariants, maxPopulation } = regEntry;

  // Run matchThai against each real-world variant
  const allMatches = [];
  let bestMatch = null;

  for (const [target, count] of Object.entries(realWorldVariants)) {
    const result = matchThai(thai, target, { maxVariants });
    if (result) {
      const matchEntry = {
        target,
        count,
        variant: result.variant,
        distance: result.distance,
        weight: Math.round(result.weight * 100) / 100,
        score: Math.round(result.score * 100) / 100,
      };
      allMatches.push(matchEntry);

      if (!bestMatch || result.distance < bestMatch.distance ||
          (result.distance === bestMatch.distance && result.score > bestMatch.score)) {
        bestMatch = matchEntry;
      }
    }
  }

  const quality = bestMatch ? classifyQuality(bestMatch.distance, bestMatch.target.length) : 'miss';

  if (quality === 'exact') exactCount++;
  else if (quality === 'close') closeCount++;
  else if (quality === 'partial') partialCount++;
  else missCount++;

  // Population-weighted match rate (exact or close = success)
  const pop = maxPopulation || 1;
  popWeightedDen += pop;
  if (quality === 'exact' || quality === 'close') popWeightedNum += pop;

  // For exact matches, decompose to extract weight evidence
  if (quality === 'exact' && bestMatch) {
    // Use word-level matching for better decomposition
    const words = transliterateWords(thai, { maxVariants });
    for (const word of words) {
      // Find the variant that matches
      const matched = word.variants.find(v =>
        bestMatch.variant.toLowerCase().includes(v.text.toLowerCase())
      );
      if (matched) {
        const observations = decomposeMatch(matched.text, word.thai);
        for (const obs of observations) {
          recordObservation(obs);
          decompositionCount++;
        }
      }
    }
  }

  analysisEntries.push({
    thai,
    realWorldVariants,
    bestMatch,
    quality,
    population: maxPopulation || 0,
  });
}

process.stderr.write('\n');

// Build weight evidence with current weights and frequencies
function enrichWeightEvidence() {
  const enriched = { consonants: {}, vowels: {}, clusters: {} };

  // Consonants
  for (const [char, positions] of Object.entries(weightEvidence.consonants)) {
    enriched.consonants[char] = {};
    const consEntry = CONSONANTS[char];

    for (const posType of ['initial', 'final']) {
      const counts = positions[posType];
      if (!counts || Object.keys(counts).length === 0) continue;

      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const posData = {};

      for (const [text, count] of Object.entries(counts)) {
        const currentWeight = consEntry?.[posType]?.find(v => v.text === text)?.weight ?? null;
        posData[text] = {
          count,
          frequency: Math.round(count / total * 1000) / 1000,
          currentWeight,
        };
      }

      enriched.consonants[char][posType] = posData;
    }
  }

  // Vowels
  for (const [patternId, counts] of Object.entries(weightEvidence.vowels)) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const patternEntry = VOWEL_PATTERNS[patternId];
    const patData = {};

    for (const [text, count] of Object.entries(counts)) {
      const currentWeight = patternEntry?.variants?.find(v => v.text === text)?.weight ?? null;
      patData[text] = {
        count,
        frequency: Math.round(count / total * 1000) / 1000,
        currentWeight,
      };
    }

    enriched.vowels[patternId] = patData;
  }

  // Clusters
  for (const [key, counts] of Object.entries(weightEvidence.clusters)) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const clusterData = {};

    for (const [text, count] of Object.entries(counts)) {
      clusterData[text] = {
        count,
        frequency: Math.round(count / total * 1000) / 1000,
      };
    }

    enriched.clusters[key] = clusterData;
  }

  return enriched;
}

// Sort top misses by population (most impactful first)
const topMisses = analysisEntries
  .filter(e => e.quality === 'miss')
  .sort((a, b) => (b.population || 0) - (a.population || 0))
  .slice(0, 100)
  .map(e => ({
    thai: e.thai,
    target: Object.keys(e.realWorldVariants)[0],
    bestVariant: e.bestMatch?.variant ?? null,
    distance: e.bestMatch?.distance ?? null,
    population: e.population,
  }));

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
const total = entries.length;

const output = {
  metadata: {
    analyzedAt: new Date().toISOString(),
    totalEntries: total,
    exactMatches: exactCount,
    closeMatches: closeCount,
    partialMatches: partialCount,
    misses: missCount,
    matchRateExact: Math.round(exactCount / total * 1000) / 1000,
    matchRateClose: Math.round((exactCount + closeCount) / total * 1000) / 1000,
    matchRatePartial: Math.round((exactCount + closeCount + partialCount) / total * 1000) / 1000,
    populationWeightedMatchRate: Math.round(popWeightedNum / popWeightedDen * 1000) / 1000,
    decompositions: decompositionCount,
    elapsedSeconds: parseFloat(elapsed),
  },
  weightEvidence: enrichWeightEvidence(),
  topMisses,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.error(`\nAnalysis written to ${outputPath}`);
console.error(`  Total entries: ${total}`);
console.error(`  Exact matches: ${exactCount} (${(exactCount / total * 100).toFixed(1)}%)`);
console.error(`  Close matches: ${closeCount} (${(closeCount / total * 100).toFixed(1)}%)`);
console.error(`  Partial matches: ${partialCount} (${(partialCount / total * 100).toFixed(1)}%)`);
console.error(`  Misses: ${missCount} (${(missCount / total * 100).toFixed(1)}%)`);
console.error(`  Pop-weighted match rate: ${(popWeightedNum / popWeightedDen * 100).toFixed(1)}%`);
console.error(`  Weight decompositions: ${decompositionCount}`);
console.error(`  Elapsed: ${elapsed}s`);
