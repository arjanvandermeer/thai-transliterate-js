#!/usr/bin/env node
/**
 * Extract Thai↔Latin name pairs from GeoNames TH.zip into a registry.
 *
 * Usage: node scripts/extract-geonames.js [--input data/TH.zip] [--output data/registry-geonames.json]
 */

import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
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
const inputPath = argValue('--input', join(root, 'data', 'TH.zip'));
const outputPath = argValue('--output', join(root, 'data', 'registry-geonames.json'));

// Thai character range
const THAI_RE = /[\u0E01-\u0E5B]/;
const LATIN_START_RE = /^[A-Za-z]/;

/**
 * Detect ISO 11940 machine transliterations.
 * These use: x for sara oe, æ, and produce sequences like khlxng, dxy, hwy.
 * They're always all-lowercase with no capitals.
 */
function isIsoTransliteration(name) {
  // Must start with a Latin character
  if (!LATIN_START_RE.test(name)) return false;
  // ISO 11940 is always all-lowercase
  if (name !== name.toLowerCase()) return false;
  // Contains x (sara oe marker) or æ
  if (/[xæ]/.test(name)) return true;
  // Contains typical ISO 11940 sequences not found in natural romanization
  if (/(?:hwy|khlxng|thung|khea|phel|helk|ywn|dxy)/.test(name)) return true;
  return false;
}

/**
 * Check if a Latin name should be filtered out.
 */
function isJunkLatin(name) {
  if (!name || name.length < 2) return true;
  // Contains Thai characters — not a Latin variant
  if (THAI_RE.test(name)) return true;
  // Doesn't start with Latin letter
  if (!LATIN_START_RE.test(name)) return true;
  // IATA/ICAO airport codes (2-4 letter all-caps)
  if (/^[A-Z]{2,4}$/.test(name)) return true;
  // ISO 11940 machine transliteration
  if (isIsoTransliteration(name)) return true;
  // Contains non-ASCII Latin chars (ı, ʹ, zero-width joiners, combining marks, etc.)
  // Valid romanizations only use basic ASCII a-z, spaces, hyphens, apostrophes
  if (/[^\x20-\x7E]/.test(name)) return true;
  // Contains only digits after letters (e.g. highway numbers)
  if (/^[A-Za-z]+\d+$/.test(name)) return true;
  return false;
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
const raw = execSync(`unzip -p "${inputPath}" TH.txt`, { maxBuffer: 100 * 1024 * 1024 }).toString('utf-8');
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

  const { name, asciiName, thaiNames, latinAlts, featureClass, population } = parsed;

  // Collect all valid Latin variants for this entry
  const latinVariants = new Map(); // text → count increment

  // Primary name and ASCII name get a boost (count as 2)
  if (!isJunkLatin(name)) {
    latinVariants.set(name, 2);
  }
  if (asciiName && asciiName !== name && !isJunkLatin(asciiName)) {
    latinVariants.set(asciiName, 2);
  }

  // Alternate Latin names count as 1
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
    latinVariants.set(alt, existing + 1);
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
