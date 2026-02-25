#!/usr/bin/env node
/**
 * Extract Thai↔English page title pairs from Wikipedia SQL dumps into a registry.
 *
 * Usage: node scripts/extract-wikipedia.js
 *   [--langlinks data/thwiki-latest-langlinks.sql.gz]
 *   [--pages data/thwiki-latest-page.sql.gz]
 *   [--output data/registry-wikipedia.json]
 *
 * Requires two SQL dump files from https://dumps.wikimedia.org/thwiki/latest/
 * Run `npm run calibrate:download` to fetch them.
 */

import { createReadStream, writeFileSync, existsSync } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasThai, isValidLatin } from './lib/filters.js';
import { argValue } from './lib/args.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const langlinksPath = argValue('--langlinks', join(root, 'data', 'thwiki-latest-langlinks.sql.gz'));
const pagesPath = argValue('--pages', join(root, 'data', 'thwiki-latest-page.sql.gz'));
const outputPath = argValue('--output', join(root, 'data', 'registry-wikipedia.json'));

if (!existsSync(langlinksPath) || !existsSync(pagesPath)) {
  console.error('Missing Wikipedia SQL dumps. Run `npm run calibrate:download` first.');
  console.error(`  langlinks: ${existsSync(langlinksPath) ? 'OK' : 'MISSING'} (${langlinksPath})`);
  console.error(`  pages:     ${existsSync(pagesPath) ? 'OK' : 'MISSING'} (${pagesPath})`);
  process.exit(1);
}

/**
 * Stream-parse a gzipped SQL dump file, calling handler for each INSERT line.
 */
async function parseSqlDump(filePath, handler) {
  const gunzip = createGunzip();
  const rl = createInterface({
    input: createReadStream(filePath).pipe(gunzip),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.startsWith('INSERT INTO')) {
      handler(line);
    }
  }
}

/**
 * Unescape MySQL string escapes.
 */
function unescapeSql(str) {
  return str
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/_/g, ' ');
}

// Phase 1: Parse page.sql.gz → Map<pageId, thaiTitle>
console.error('Phase 1: Parsing page titles from', pagesPath);
const pages = new Map();
let pageLines = 0;

await parseSqlDump(pagesPath, (line) => {
  pageLines++;
  // page table: (page_id, page_namespace, page_title, ...)
  // Match tuples like (123,0,'ชื่อหน้า',...)
  const re = /\((\d+),(\d+),'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(line))) {
    const pageId = parseInt(m[1], 10);
    const ns = parseInt(m[2], 10);
    const title = unescapeSql(m[3]);

    // Only main namespace (0) with Thai titles
    if (ns === 0 && hasThai(title)) {
      pages.set(pageId, title);
    }
  }
});

console.error(`  Parsed ${pageLines} INSERT lines, found ${pages.size} Thai pages`);

// Phase 2: Parse langlinks.sql.gz → Map<pageId, englishTitle>
console.error('Phase 2: Parsing langlinks from', langlinksPath);
const langlinks = new Map();
let llLines = 0;

await parseSqlDump(langlinksPath, (line) => {
  llLines++;
  // langlinks table: (ll_from, ll_lang, ll_title)
  // Match tuples like (123,'en','Bangkok')
  const re = /\((\d+),'en','((?:[^'\\]|\\.)*)'\)/g;
  let m;
  while ((m = re.exec(line))) {
    const pageId = parseInt(m[1], 10);
    const enTitle = unescapeSql(m[2]);
    langlinks.set(pageId, enTitle);
  }
});

console.error(`  Parsed ${llLines} INSERT lines, found ${langlinks.size} English langlinks`);

// Phase 3: Join on pageId → Thai title ↔ English title pairs
console.error('Phase 3: Joining pages with langlinks...');
const registry = new Map();
let totalPairs = 0;
let skippedInvalid = 0;

for (const [pageId, thaiTitle] of pages) {
  const enTitle = langlinks.get(pageId);
  if (!enTitle) continue;
  if (!isValidLatin(enTitle)) {
    skippedInvalid++;
    continue;
  }

  let entry = registry.get(thaiTitle);
  if (!entry) {
    entry = { variants: new Map(), featureClasses: new Set() };
    registry.set(thaiTitle, entry);
  }

  const existing = entry.variants.get(enTitle) || 0;
  entry.variants.set(enTitle, existing + 1);
  entry.featureClasses.add('article');
  totalPairs++;
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
    source: 'wikipedia',
    extractedAt: new Date().toISOString(),
    totalPages: pages.size,
    totalLanglinks: langlinks.size,
    uniqueThaiNames: registry.size,
    totalPairs,
    skippedInvalid,
  },
  entries,
};

writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n');
console.error(`\nRegistry written to ${outputPath}`);
console.error(`  Thai pages: ${pages.size}`);
console.error(`  English langlinks: ${langlinks.size}`);
console.error(`  Matched pairs: ${totalPairs}`);
console.error(`  Unique Thai names: ${registry.size}`);
console.error(`  Skipped invalid Latin: ${skippedInvalid}`);
