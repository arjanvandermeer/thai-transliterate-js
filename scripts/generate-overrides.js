#!/usr/bin/env node
/**
 * Generate weight-overrides.json from analysis data.
 * Only produces overrides where data-derived weights differ significantly from base weights.
 *
 * Usage: node scripts/generate-overrides.js [--input data/analysis.json] [--output src/tables/weight-overrides.json]
 *   [--min-observations 10] [--min-delta 0.1]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONSONANTS as BASE_CONSONANTS } from '../src/tables/consonants.js';
import { VOWEL_PATTERNS as BASE_VOWEL_PATTERNS } from '../src/tables/vowels.js';
import { THOR_SO_VARIANTS, SOR_RO_VARIANTS } from '../src/tables/clusters.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}
const inputPath = argValue('--input', join(root, 'data', 'analysis.json'));
const outputPath = argValue('--output', join(root, 'src', 'tables', 'weight-overrides.json'));
const minObservations = parseInt(argValue('--min-observations', '10'), 10);
const minDelta = parseFloat(argValue('--min-delta', '0.1'));

const analysis = JSON.parse(readFileSync(inputPath, 'utf-8'));
const evidence = analysis.weightEvidence;

const overrides = {
  _meta: {
    generatedAt: new Date().toISOString(),
    description: 'Data-derived weight overrides. Regenerate with: npm run calibrate',
    sources: analysis.metadata,
    minObservations,
    minDelta,
  },
  consonants: {},
  vowels: {},
  clusters: {},
};

let overrideCount = 0;
const changes = [];

/**
 * Given frequency data for a group of variants, compute normalized weights.
 * Highest frequency gets 1.0, others scale proportionally.
 */
function frequencyToWeights(freqMap) {
  const maxFreq = Math.max(...Object.values(freqMap).map(v => v.frequency));
  if (maxFreq === 0) return {};

  const weights = {};
  for (const [text, data] of Object.entries(freqMap)) {
    // Floor at 0.01 — never fully eliminate a variant, only downweight it
    weights[text] = Math.max(0.01, Math.round(data.frequency / maxFreq * 100) / 100);
  }
  return weights;
}

/**
 * Check total observations for a variant group.
 */
function totalObservations(freqMap) {
  return Object.values(freqMap).reduce((sum, v) => sum + v.count, 0);
}

// Process consonant evidence
for (const [char, positions] of Object.entries(evidence.consonants)) {
  const consEntry = BASE_CONSONANTS[char];
  if (!consEntry) continue;

  const charOverrides = {};
  let hasOverrides = false;

  for (const posType of ['initial', 'final']) {
    const posEvidence = positions[posType];
    if (!posEvidence) continue;

    const total = totalObservations(posEvidence);
    if (total < minObservations) continue;

    const dataWeights = frequencyToWeights(posEvidence);
    const baseVariants = consEntry[posType] || [];
    const posOverrides = {};
    let posHasOverrides = false;

    // Check each variant that appears in both base and evidence
    for (const baseV of baseVariants) {
      const dataWeight = dataWeights[baseV.text];
      if (dataWeight !== undefined && Math.abs(dataWeight - baseV.weight) >= minDelta) {
        posOverrides[baseV.text] = dataWeight;
        posHasOverrides = true;
        overrideCount++;
        changes.push({
          type: 'consonant', char, position: posType, variant: baseV.text,
          baseWeight: baseV.weight, dataWeight, observations: total,
          delta: Math.round((dataWeight - baseV.weight) * 100) / 100,
        });
      }
    }

    if (posHasOverrides) {
      charOverrides[posType] = posOverrides;
      hasOverrides = true;
    }
  }

  if (hasOverrides) {
    overrides.consonants[char] = charOverrides;
  }
}

// Process vowel evidence
for (const [patternId, patEvidence] of Object.entries(evidence.vowels)) {
  const patEntry = BASE_VOWEL_PATTERNS[patternId];
  if (!patEntry) continue;

  const total = totalObservations(patEvidence);
  if (total < minObservations) continue;

  const dataWeights = frequencyToWeights(patEvidence);
  const patOverrides = {};
  let hasOverrides = false;

  for (const baseV of patEntry.variants) {
    const dataWeight = dataWeights[baseV.text];
    if (dataWeight !== undefined && Math.abs(dataWeight - baseV.weight) >= minDelta) {
      patOverrides[baseV.text] = dataWeight;
      hasOverrides = true;
      overrideCount++;
      changes.push({
        type: 'vowel', pattern: patternId, variant: baseV.text,
        baseWeight: baseV.weight, dataWeight, observations: total,
        delta: Math.round((dataWeight - baseV.weight) * 100) / 100,
      });
    }
  }

  if (hasOverrides) {
    overrides.vowels[patternId] = patOverrides;
  }
}

// Process cluster evidence (ทร and ศร special clusters)
const clusterSources = {
  'ทร': THOR_SO_VARIANTS,
  'ศร': SOR_RO_VARIANTS,
};

for (const [key, baseVariants] of Object.entries(clusterSources)) {
  const clusterEvidence = evidence.clusters[key];
  if (!clusterEvidence) continue;

  const total = totalObservations(clusterEvidence);
  if (total < minObservations) continue;

  const dataWeights = frequencyToWeights(clusterEvidence);
  const clusterOverrides = {};
  let hasOverrides = false;

  for (const baseV of baseVariants) {
    const dataWeight = dataWeights[baseV.text];
    if (dataWeight !== undefined && Math.abs(dataWeight - baseV.weight) >= minDelta) {
      clusterOverrides[baseV.text] = dataWeight;
      hasOverrides = true;
      overrideCount++;
      changes.push({
        type: 'cluster', cluster: key, variant: baseV.text,
        baseWeight: baseV.weight, dataWeight, observations: total,
        delta: Math.round((dataWeight - baseV.weight) * 100) / 100,
      });
    }
  }

  if (hasOverrides) {
    overrides.clusters[key] = clusterOverrides;
  }
}

// Write overrides file
writeFileSync(outputPath, JSON.stringify(overrides, null, 2) + '\n');

// Print summary
changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

console.error(`Weight overrides written to ${outputPath}`);
console.error(`  Total overrides: ${overrideCount}`);
console.error(`  Min observations: ${minObservations}`);
console.error(`  Min delta: ${minDelta}`);
console.error(`\nTop changes (by magnitude):`);
for (const c of changes.slice(0, 20)) {
  const direction = c.delta > 0 ? '↑' : '↓';
  const label = c.type === 'consonant'
    ? `${c.char} ${c.position} '${c.variant}'`
    : c.type === 'vowel'
      ? `${c.pattern} '${c.variant}'`
      : `${c.cluster} '${c.variant}'`;
  console.error(`  ${direction} ${label}: ${c.baseWeight} → ${c.dataWeight} (${c.delta > 0 ? '+' : ''}${c.delta}, ${c.observations} obs)`);
}
