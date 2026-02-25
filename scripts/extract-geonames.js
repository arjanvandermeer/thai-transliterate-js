#!/usr/bin/env node
/**
 * Extract Thai↔Latin name pairs from GeoNames TH.zip into a registry.
 *
 * Usage: node scripts/extract-geonames.js [--input data/TH.zip] [--output data/registry-geonames.json]
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { THAI_RE, LATIN_START_RE, isIsoTransliteration, isJunkLatin } from './lib/filters.js';
import { argValue } from './lib/args.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const inputPath = argValue('--input', join(root, 'data', 'TH.zip'));
const outputPath = argValue('--output', join(root, 'data', 'registry-geonames.json'));

// Feature code multipliers — granular GeoNames codes (checked first)
const FEATURE_CODE_MULTIPLIERS = {
  AIRP: 3,     // airport
  AIRF: 3,     // airfield
  AIRB: 3,     // airbase
  RSTN: 3,     // railroad station
  BUSTN: 2,    // bus station
  PPLC: 2,     // capital of a country
  PPLA: 1.5,   // capital of a first-order admin division (province capital)
  MNMT: 1.5,   // monument
  SHRN: 1.5,   // shrine
  RLG: 1.5,    // religious site
  TMPL: 1.5,   // temple
};

// Feature class multipliers — broad GeoNames classes (fallback)
const FEATURE_CLASS_MULTIPLIERS = {
  A: 1,      // administrative (provinces, districts)
  P: 1,      // populated places
  S: 0.8,    // structures (schools, temples, misc buildings)
  H: 0.5,    // hydrographic (streams, canals)
  T: 0.5,    // terrain (mountains, hills)
  L: 0.5,    // parks, areas
  R: 0.5,    // roads, railroads
  V: 0.5,    // vegetation
};

function getGeonamesMultiplier(featureClass, featureCode) {
  return FEATURE_CODE_MULTIPLIERS[featureCode] ?? FEATURE_CLASS_MULTIPLIERS[featureClass] ?? 1;
}

/**
 * Parse a single GeoNames tab-delimited line.
 * Returns null if the line should be skipped.
 */
function parseLine(line) {
  const cols = line.split('\t');
  if (cols.length < 15) return null;

  const name = cols[1]?.trim();
  const asciiName = cols[2]?.trim();
  const alternates = cols[3]?.trim() || '';
  const featureClass = cols[6]?.trim();
  const featureCode = cols[7]?.trim();
  const population = parseInt(cols[14], 10) || 0;

  if (!name) return null;

  // Split alternates by comma
  const altList = alternates ? alternates.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Separate Thai and Latin names
  const thaiNames = altList.filter(n => THAI_RE.test(n));
  const latinAlts = altList.filter(n => !THAI_RE.test(n) && LATIN_START_RE.test(n));

  // Skip entries with no Thai names
  if (thaiNames.length === 0) return null;

  return { name, asciiName, thaiNames, latinAlts, featureClass, featureCode, population };
}

// Read and parse TH.txt from zip
console.error('Extracting TH.txt from', inputPath);
const raw = execFileSync('unzip', ['-p', inputPath, 'TH.txt'], { maxBuffer: 100 * 1024 * 1024 }).toString('utf-8');
const lines = raw.split('\n');
console.error(`Read ${lines.length} lines`);

// Build registry: Thai name → { variants, featureClasses, maxPopulation }
const registry = new Map();
let totalPairs = 0;
let skippedIso = 0;
let skippedJunk = 0;

for (const line of lines) {
  if (!line.trim()) continue;

  const parsed = parseLine(line);
  if (!parsed) continue;

  const { name, asciiName, thaiNames, latinAlts, featureClass, featureCode, population } = parsed;

  // Collect all valid Latin variants for this entry
  const latinVariants = new Map(); // text → count increment
  const multiplier = getGeonamesMultiplier(featureClass, featureCode);

  // Primary name and ASCII name get a boost (count as 2 × multiplier)
  if (!isJunkLatin(name)) {
    latinVariants.set(name, 2 * multiplier);
  }
  if (asciiName && asciiName !== name && !isJunkLatin(asciiName)) {
    latinVariants.set(asciiName, 2 * multiplier);
  }

  // Alternate Latin names count as 1 × multiplier
  for (const alt of latinAlts) {
    if (isJunkLatin(alt)) {
      skippedJunk++;
      continue;
    }
    if (isIsoTransliteration(alt)) {
      skippedIso++;
      continue;
    }
    const existing = latinVariants.get(alt) || 0;
    latinVariants.set(alt, existing + 1 * multiplier);
  }

  if (latinVariants.size === 0) continue;

  // Register each Thai name with the Latin variants
  for (const thai of thaiNames) {
    let entry = registry.get(thai);
    if (!entry) {
      entry = { variants: new Map(), featureClasses: new Set(), maxPopulation: 0 };
      registry.set(thai, entry);
    }

    for (const [latin, count] of latinVariants) {
      const existing = entry.variants.get(latin) || 0;
      entry.variants.set(latin, existing + count);
      totalPairs++;
    }

    entry.featureClasses.add(featureClass);
    entry.maxPopulation = Math.max(entry.maxPopulation, population);
  }
}

// Convert to JSON-serializable format
const entries = {};
for (const [thai, entry] of registry) {
  const variants = {};
  for (const [latin, count] of entry.variants) {
    variants[latin] = count;
  }
  entries[thai] = {
    variants,
    featureClasses: [...entry.featureClasses],
    maxPopulation: entry.maxPopulation,
  };
}

const output = {
  metadata: {
    source: 'geonames',
    extractedAt: new Date().toISOString(),
    totalGeonamesLines: lines.length,
    uniqueThaiNames: registry.size,
    totalPairs,
    skippedIso,
    skippedJunk,
  },
  entries,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.error(`\nRegistry written to ${outputPath}`);
console.error(`  Unique Thai names: ${registry.size}`);
console.error(`  Total Thai↔Latin pairs: ${totalPairs}`);
console.error(`  Skipped ISO 11940: ${skippedIso}`);
console.error(`  Skipped junk: ${skippedJunk}`);
