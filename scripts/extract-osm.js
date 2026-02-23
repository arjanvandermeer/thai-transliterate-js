#!/usr/bin/env node
/**
 * Extract Thai↔Latin name pairs from OpenStreetMap PBF data into a registry.
 *
 * Usage: node scripts/extract-osm.js [--input data/thailand-latest.osm.pbf] [--output data/registry-osm.json]
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOSMStream } from 'osm-pbf-parser-node';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}
const inputPath = argValue('--input', join(root, 'data', 'thailand-latest.osm.pbf'));
const outputPath = argValue('--output', join(root, 'data', 'registry-osm.json'));

const THAI_RE = /[\u0E01-\u0E5B]/;
const LATIN_START_RE = /^[A-Za-z]/;

// Category weight multipliers — controls how much each OSM category counts
// Higher multiplier = more influence on variant ranking in the merged dictionary
const CATEGORY_MULTIPLIERS = {
  aeroway: 3,      // airports
  station: 3,      // train/BTS/MRT stations
  tourism: 1.5,    // tourist attractions, museums
  place: 1,        // cities, villages, districts
  boundary: 1,     // admin boundaries
  highway: 0.8,    // roads
  building: 0.5,   // generic buildings
  amenity: 0.5,    // restaurants, banks, etc.
  shop: 0.3,       // retail
  other: 0.5,      // uncategorized
};

/**
 * Check if a string contains Thai characters.
 */
function hasThai(str) {
  return str && THAI_RE.test(str);
}

/**
 * Check if a string is a plausible Latin romanization.
 */
function isValidLatin(str) {
  if (!str || str.length < 2) return false;
  if (!LATIN_START_RE.test(str)) return false;
  if (THAI_RE.test(str)) return false;
  // Only allow printable ASCII
  if (/[^\x20-\x7E]/.test(str)) return false;
  return true;
}

console.error('Parsing OSM PBF from', inputPath);

const registry = new Map();
let totalEntities = 0;
let matchedEntities = 0;
let totalPairs = 0;

const osmStream = createOSMStream(inputPath);

for await (const item of osmStream) {
  totalEntities++;

  if (totalEntities % 1_000_000 === 0) {
    process.stderr.write(`  ${(totalEntities / 1_000_000).toFixed(0)}M entities, ${matchedEntities} matched\r`);
  }

  const tags = item.tags;
  if (!tags) continue;

  // Collect Thai names from tags
  const thaiNames = new Set();
  const latinNames = new Set();

  // name:th is the explicit Thai tag
  if (tags['name:th'] && hasThai(tags['name:th'])) {
    thaiNames.add(tags['name:th']);
  }

  // name may be in Thai (common in Thailand OSM data)
  if (tags.name && hasThai(tags.name) && tags.name !== tags['name:th']) {
    thaiNames.add(tags.name);
  }

  // addr:street:th for street addresses
  if (tags['addr:street:th'] && hasThai(tags['addr:street:th'])) {
    thaiNames.add(tags['addr:street:th']);
  }

  if (thaiNames.size === 0) continue;

  // Collect Latin names
  if (tags['name:en'] && isValidLatin(tags['name:en'])) {
    latinNames.add(tags['name:en']);
  }

  // name:th-Latn is an explicit romanization
  if (tags['name:th-Latn'] && isValidLatin(tags['name:th-Latn'])) {
    latinNames.add(tags['name:th-Latn']);
  }

  // name tag if it's Latin (and different from name:en)
  if (tags.name && isValidLatin(tags.name) && !hasThai(tags.name) && tags.name !== tags['name:en']) {
    latinNames.add(tags.name);
  }

  // addr:street for street name romanization
  if (tags['addr:street'] && isValidLatin(tags['addr:street']) && !hasThai(tags['addr:street'])) {
    latinNames.add(tags['addr:street']);
  }

  if (latinNames.size === 0) continue;

  matchedEntities++;

  // Determine feature type from OSM tags
  const featureClass = categorizeOSMTags(tags);
  const multiplier = CATEGORY_MULTIPLIERS[featureClass] ?? 1;

  for (const thai of thaiNames) {
    let entry = registry.get(thai);
    if (!entry) {
      entry = { variants: new Map(), featureClasses: new Set() };
      registry.set(thai, entry);
    }

    for (const latin of latinNames) {
      const existing = entry.variants.get(latin) || 0;
      entry.variants.set(latin, existing + multiplier);
      totalPairs++;
    }

    entry.featureClasses.add(featureClass);
  }
}

process.stderr.write('\n');

/**
 * Categorize an OSM entity by its tags into a feature class.
 */
function categorizeOSMTags(tags) {
  if (tags.aeroway) return 'aeroway';
  if (tags.railway || tags.station) return 'station';
  if (tags.place) return 'place';
  if (tags.tourism) return 'tourism';
  if (tags.boundary) return 'boundary';
  if (tags.highway) return 'highway';
  if (tags.amenity) return 'amenity';
  if (tags.shop) return 'shop';
  if (tags.building) return 'building';
  return 'other';
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
  };
}

const output = {
  metadata: {
    source: 'osm',
    extractedAt: new Date().toISOString(),
    totalEntities,
    matchedEntities,
    uniqueThaiNames: registry.size,
    totalPairs,
  },
  entries,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.error(`\nRegistry written to ${outputPath}`);
console.error(`  Total entities scanned: ${totalEntities}`);
console.error(`  Entities with Thai+Latin: ${matchedEntities}`);
console.error(`  Unique Thai names: ${registry.size}`);
console.error(`  Total Thai↔Latin pairs: ${totalPairs}`);
