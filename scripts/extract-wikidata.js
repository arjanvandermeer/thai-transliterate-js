#!/usr/bin/env node
/**
 * Extract Thai↔Latin name pairs from Wikidata via SPARQL into a registry.
 *
 * Usage: node scripts/extract-wikidata.js [--output data/registry-wikidata.json] [--force]
 *
 * Fetches data from the Wikidata SPARQL endpoint. Caches raw results to
 * data/wikidata-raw.json. Skips fetch if cache is < 24h old (use --force).
 *
 * Rate-limited: ~2s delay between requests, exponential backoff on 429/500.
 * Expected runtime: 30–60 minutes for full extraction.
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasThai, isValidLatin } from './lib/filters.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Parse CLI args
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}
const outputPath = argValue('--output', join(root, 'data', 'registry-wikidata.json'));
const cachePath = join(root, 'data', 'wikidata-raw.json');
const force = args.includes('--force');

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_DELAY_MS = 2000;
const PAGE_SIZE = 10000;
const MAX_RETRIES = 3;

/**
 * Entity type categories with Wikidata Q-IDs and weight multipliers.
 */
const CATEGORIES = [
  {
    name: 'transport',
    multiplier: 3,
    types: ['Q55488', 'Q1248784', 'Q62447'],  // railway station, airport, bus station
  },
  {
    name: 'places',
    multiplier: 1.5,
    types: ['Q515', 'Q5119', 'Q3957', 'Q532', 'Q23442', 'Q34763'],  // city, capital, town, village, island, peninsula
  },
  {
    name: 'admin',
    multiplier: 1.5,
    types: ['Q6256', 'Q36784', 'Q50198', 'Q2093656'],  // country, province, district, subdistrict of Thailand
  },
  {
    name: 'people',
    multiplier: 0.8,
    types: ['Q5'],  // human
  },
  {
    name: 'organizations',
    multiplier: 0.6,
    types: ['Q43229', 'Q4830453', 'Q7278'],  // organization, business, political party
  },
  {
    name: 'other',
    multiplier: 0.3,
    types: ['Q11424', 'Q7889', 'Q482994', 'Q134556'],  // film, video game, album, single
  },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a SPARQL query against the Wikidata endpoint.
 */
async function sparqlQuery(query) {
  const response = await fetch(SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/sparql-results+json',
      'User-Agent': 'thai-transliterate/1.0 (calibration pipeline; https://github.com/arjanvandermeer/thai-transliterate-js)',
    },
    body: `query=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`SPARQL ${response.status}: ${response.statusText} — ${body.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Execute a paginated SPARQL query with retries and rate limiting.
 * Returns all result bindings across all pages.
 */
async function paginatedQuery(category) {
  const allBindings = [];
  let offset = 0;

  const typeValues = category.types.map(t => `wd:${t}`).join(' ');

  while (true) {
    const query = `
      SELECT ?item ?thLabel ?enLabel ?sitelinks WHERE {
        ?item wdt:P31 ?type .
        VALUES ?type { ${typeValues} }
        ?item rdfs:label ?thLabel . FILTER(LANG(?thLabel) = "th")
        ?item rdfs:label ?enLabel . FILTER(LANG(?enLabel) = "en")
        ?item wikibase:sitelinks ?sitelinks .
      }
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `;

    let result;
    let retries = 0;
    while (true) {
      try {
        result = await sparqlQuery(query);
        break;
      } catch (err) {
        retries++;
        if (retries > MAX_RETRIES) {
          console.error(`    FAILED after ${MAX_RETRIES} retries: ${err.message}`);
          return allBindings; // return what we have
        }
        const backoff = REQUEST_DELAY_MS * Math.pow(2, retries);
        console.error(`    Retry ${retries}/${MAX_RETRIES} after ${backoff}ms: ${err.message}`);
        await sleep(backoff);
      }
    }

    const bindings = result?.results?.bindings || [];
    allBindings.push(...bindings);

    process.stderr.write(`    ${category.name}: ${allBindings.length} results (offset ${offset})\r`);

    if (bindings.length < PAGE_SIZE) break; // last page
    offset += PAGE_SIZE;
    await sleep(REQUEST_DELAY_MS);
  }

  process.stderr.write('\n');
  return allBindings;
}

/**
 * Fetch aliases (skos:altLabel) for a category.
 */
async function fetchAliases(category) {
  const allBindings = [];
  let offset = 0;

  const typeValues = category.types.map(t => `wd:${t}`).join(' ');

  while (true) {
    const query = `
      SELECT ?item ?thAlt ?enAlt WHERE {
        ?item wdt:P31 ?type .
        VALUES ?type { ${typeValues} }
        {
          ?item skos:altLabel ?thAlt . FILTER(LANG(?thAlt) = "th")
          ?item rdfs:label ?enAlt . FILTER(LANG(?enAlt) = "en")
        } UNION {
          ?item rdfs:label ?thAlt . FILTER(LANG(?thAlt) = "th")
          ?item skos:altLabel ?enAlt . FILTER(LANG(?enAlt) = "en")
        }
      }
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `;

    let result;
    let retries = 0;
    while (true) {
      try {
        result = await sparqlQuery(query);
        break;
      } catch (err) {
        retries++;
        if (retries > MAX_RETRIES) {
          console.error(`    FAILED aliases after ${MAX_RETRIES} retries: ${err.message}`);
          return allBindings;
        }
        const backoff = REQUEST_DELAY_MS * Math.pow(2, retries);
        console.error(`    Retry ${retries}/${MAX_RETRIES} after ${backoff}ms: ${err.message}`);
        await sleep(backoff);
      }
    }

    const bindings = result?.results?.bindings || [];
    allBindings.push(...bindings);

    process.stderr.write(`    ${category.name} aliases: ${allBindings.length} results (offset ${offset})\r`);

    if (bindings.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    await sleep(REQUEST_DELAY_MS);
  }

  process.stderr.write('\n');
  return allBindings;
}

// Check cache
let rawData;

if (!force && existsSync(cachePath)) {
  const stats = statSync(cachePath);
  if (Date.now() - stats.mtimeMs < MAX_AGE_MS) {
    console.error('Loading cached Wikidata results from', cachePath);
    rawData = JSON.parse(readFileSync(cachePath, 'utf-8'));
  }
}

if (!rawData) {
  console.error('Fetching data from Wikidata SPARQL endpoint...');
  console.error('This may take 30–60 minutes due to rate limiting.\n');

  rawData = { categories: [], fetchedAt: new Date().toISOString() };

  for (const category of CATEGORIES) {
    console.error(`  Fetching ${category.name} (types: ${category.types.join(', ')})...`);

    const labels = await paginatedQuery(category);
    console.error(`    ${category.name} labels: ${labels.length}`);

    await sleep(REQUEST_DELAY_MS);

    const aliases = await fetchAliases(category);
    console.error(`    ${category.name} aliases: ${aliases.length}`);

    rawData.categories.push({
      name: category.name,
      multiplier: category.multiplier,
      labels,
      aliases,
    });

    await sleep(REQUEST_DELAY_MS);
  }

  // Cache raw results
  writeFileSync(cachePath, JSON.stringify(rawData, null, 2) + '\n');
  console.error(`\nCached raw results to ${cachePath}`);
}

// Build registry from raw data
console.error('\nBuilding registry...');
const registry = new Map();
let totalPairs = 0;
let skippedInvalid = 0;

for (const category of rawData.categories) {
  const multiplier = category.multiplier;

  // Process labels (rdfs:label pairs)
  for (const binding of category.labels) {
    const thLabel = binding.thLabel?.value;
    const enLabel = binding.enLabel?.value;
    const sitelinks = parseInt(binding.sitelinks?.value || '0', 10);

    if (!thLabel || !enLabel) continue;
    if (!hasThai(thLabel) || !isValidLatin(enLabel)) {
      skippedInvalid++;
      continue;
    }

    const sitelinkBonus = Math.min(2.0, 1.0 + sitelinks / 100);
    const weight = multiplier * sitelinkBonus;

    let entry = registry.get(thLabel);
    if (!entry) {
      entry = { variants: new Map(), featureClasses: new Set() };
      registry.set(thLabel, entry);
    }

    const existing = entry.variants.get(enLabel) || 0;
    entry.variants.set(enLabel, existing + weight);
    entry.featureClasses.add(category.name);
    totalPairs++;
  }

  // Process aliases (skos:altLabel pairs)
  for (const binding of category.aliases) {
    const thAlt = binding.thAlt?.value;
    const enAlt = binding.enAlt?.value;

    if (!thAlt || !enAlt) continue;
    if (!hasThai(thAlt) || !isValidLatin(enAlt)) {
      skippedInvalid++;
      continue;
    }

    // Aliases get half the weight of primary labels
    const weight = multiplier * 0.5;

    let entry = registry.get(thAlt);
    if (!entry) {
      entry = { variants: new Map(), featureClasses: new Set() };
      registry.set(thAlt, entry);
    }

    const existing = entry.variants.get(enAlt) || 0;
    entry.variants.set(enAlt, existing + weight);
    entry.featureClasses.add(category.name);
    totalPairs++;
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
  };
}

const output = {
  metadata: {
    source: 'wikidata',
    extractedAt: new Date().toISOString(),
    uniqueThaiNames: registry.size,
    totalPairs,
    skippedInvalid,
    categories: rawData.categories.map(c => ({
      name: c.name,
      labels: c.labels.length,
      aliases: c.aliases.length,
    })),
  },
  entries,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.error(`\nRegistry written to ${outputPath}`);
console.error(`  Unique Thai names: ${registry.size}`);
console.error(`  Total Thai↔Latin pairs: ${totalPairs}`);
console.error(`  Skipped invalid: ${skippedInvalid}`);
