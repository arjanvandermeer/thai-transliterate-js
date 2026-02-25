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

import { readFileSync, writeFileSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasThai, isValidLatin } from './lib/filters.js';
import { argValue, hasFlag } from './lib/args.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const outputPath = argValue('--output', join(root, 'data', 'registry-wikidata.json'));
const cachePath = join(root, 'data', 'wikidata-raw.json');
const force = hasFlag('--force');

const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REQUEST_DELAY_MS = 2000;
const PAGE_SIZE = 2000;   // keep small — large responses get truncated by the endpoint
const MAX_RETRIES = 5;

/**
 * Entity type categories with Wikidata Q-IDs and weight multipliers.
 *
 * Type-based categories use `wdt:P31` queries scoped to specific entity types.
 * The `wiki_entities` category uses a Wikipedia-side query (no P31 filter) to
 * capture all Thai Wikipedia entities — people, orgs, films, etc. — without
 * crashing Blazegraph on broad type joins like Q5 (human, ~10M entities).
 */
const CATEGORIES = [
  {
    name: 'transport',
    multiplier: 3,
    types: ['Q55488', 'Q1248784', 'Q62447'],  // railway station, airport, bus station
  },
  {
    name: 'admin',
    multiplier: 1.5,
    types: ['Q6256', 'Q36784', 'Q50198', 'Q2093656'],  // country, province, district, subdistrict of Thailand
  },
  {
    // Queries FROM Thai Wikipedia articles (~180K) instead of by entity type.
    // Broad type+sitelink joins (places, people, orgs) crash Blazegraph, so we
    // start from the Wikipedia side which is bounded and reliable.
    // Places are already well-covered by GeoNames + OSM with proper weighting.
    name: 'wiki_entities',
    multiplier: 0.5,
    wikiQuery: true,
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

  // Read as text — the SPARQL endpoint sometimes returns truncated JSON
  // (partial response + error marker like "SPARQL-QUERY-..."), or labels
  // with unescaped control characters in string values.
  let text = await response.text();

  // Strip control characters inside JSON string values (not structural whitespace)
  // Replace chars 0x00-0x08, 0x0B-0x0C, 0x0E-0x1F (NOT \t \n \r which are valid JSON whitespace)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // If the response is truncated, the JSON won't end with proper closing braces.
  // Truncate at the last complete binding (last "}") before any trailing garbage.
  try {
    return JSON.parse(text);
  } catch {
    // Try to salvage: find the last valid JSON closing sequence
    const lastBrace = text.lastIndexOf('}}');
    if (lastBrace > 0) {
      const truncated = text.slice(0, lastBrace + 2) + ']}';
      try {
        return JSON.parse(truncated);
      } catch {
        // noop — fall through to throw
      }
    }
    throw new Error(`Invalid JSON response (${text.length} bytes, ends with: "${text.slice(-60)}")`);
  }
}

/**
 * Build the SPARQL labels query for a category at a given offset.
 */
function buildLabelsQuery(category, offset) {
  if (category.wikiQuery) {
    // Query from Thai Wikipedia side — avoids expensive P31 joins that crash Blazegraph
    return `
      SELECT ?item ?thLabel ?enLabel ?sitelinks WHERE {
        ?article schema:about ?item ;
                 schema:isPartOf <https://th.wikipedia.org/> .
        ?item rdfs:label ?thLabel . FILTER(LANG(?thLabel) = "th")
        ?item rdfs:label ?enLabel . FILTER(LANG(?enLabel) = "en")
        ?item wikibase:sitelinks ?sitelinks .
      }
      LIMIT ${PAGE_SIZE} OFFSET ${offset}
    `;
  }

  const typeValues = category.types.map(t => `wd:${t}`).join(' ');
  const thaiWikiFilter = category.requireThaiWiki
    ? '?thWikiArticle schema:about ?item ; schema:isPartOf <https://th.wikipedia.org/> .'
    : '';

  return `
    SELECT ?item ?thLabel ?enLabel ?sitelinks WHERE {
      ?item wdt:P31 ?type .
      VALUES ?type { ${typeValues} }
      ${thaiWikiFilter}
      ?item rdfs:label ?thLabel . FILTER(LANG(?thLabel) = "th")
      ?item rdfs:label ?enLabel . FILTER(LANG(?enLabel) = "en")
      ?item wikibase:sitelinks ?sitelinks .
    }
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;
}

/**
 * Execute a paginated SPARQL query with retries and rate limiting.
 * Returns all result bindings across all pages.
 */
async function paginatedQuery(category) {
  const allBindings = [];
  let offset = 0;

  while (true) {
    const query = buildLabelsQuery(category, offset);

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
 * Build the SPARQL aliases query for a category at a given offset.
 */
function buildAliasesQuery(category, offset) {
  if (category.wikiQuery) {
    return `
      SELECT ?item ?thAlt ?enAlt WHERE {
        ?article schema:about ?item ;
                 schema:isPartOf <https://th.wikipedia.org/> .
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
  }

  const typeValues = category.types.map(t => `wd:${t}`).join(' ');
  const thaiWikiFilter = category.requireThaiWiki
    ? '?thWikiArticle schema:about ?item ; schema:isPartOf <https://th.wikipedia.org/> .'
    : '';

  return `
    SELECT ?item ?thAlt ?enAlt WHERE {
      ?item wdt:P31 ?type .
      VALUES ?type { ${typeValues} }
      ${thaiWikiFilter}
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
}

/**
 * Fetch aliases (skos:altLabel) for a category.
 */
async function fetchAliases(category) {
  const allBindings = [];
  let offset = 0;

  while (true) {
    const query = buildAliasesQuery(category, offset);

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

// Validate cached data: must have all expected categories with non-empty results
function isCacheValid(data) {
  if (!data?.categories || data.categories.length !== CATEGORIES.length) return false;
  for (const cat of data.categories) {
    if (!cat.labels?.length && !cat.aliases?.length) return false;
  }
  return true;
}

// Check cache
let rawData;

if (!force && existsSync(cachePath)) {
  const stats = statSync(cachePath);
  if (Date.now() - stats.mtimeMs < MAX_AGE_MS) {
    try {
      const cached = JSON.parse(readFileSync(cachePath, 'utf-8'));
      if (isCacheValid(cached)) {
        console.error('Loading cached Wikidata results from', cachePath);
        rawData = cached;
      } else {
        console.error('Cache incomplete (previous run failed?) — re-fetching');
      }
    } catch {
      console.error('Cache corrupt — re-fetching');
    }
  }
}

if (!rawData) {
  // Delete stale/incomplete cache before starting fresh
  if (existsSync(cachePath)) {
    unlinkSync(cachePath);
  }

  console.error('Fetching data from Wikidata SPARQL endpoint...');
  console.error('This may take 30–60 minutes due to rate limiting.\n');

  rawData = { categories: [], fetchedAt: new Date().toISOString() };

  for (const category of CATEGORIES) {
    const desc = category.wikiQuery ? 'Thai Wikipedia entities' : `types: ${category.types.join(', ')}`;
    console.error(`  Fetching ${category.name} (${desc})...`);

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

  // Only cache if all categories have data (don't persist partial failures)
  if (isCacheValid(rawData)) {
    writeFileSync(cachePath, JSON.stringify(rawData, null, 2) + '\n');
    console.error(`\nCached raw results to ${cachePath}`);
  } else {
    console.error('\nWarning: some categories had no results — not caching');
  }
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
