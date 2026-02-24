#!/usr/bin/env node
/**
 * Download fresh data files for calibration.
 *
 * Usage: node scripts/download-data.js [--force]
 *
 * Downloads:
 *   - GeoNames TH.zip from download.geonames.org
 *   - Thailand OSM PBF from download.geofabrik.de
 *   - Wikipedia langlinks and page SQL dumps from dumps.wikimedia.org
 *
 * Skips download if file exists and is < 24h old (use --force to override).
 * Non-critical downloads (Wikipedia) warn on failure instead of aborting.
 */

import { existsSync, statSync, createWriteStream, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dataDir = join(root, 'data');

const force = process.argv.includes('--force');

const DOWNLOADS = [
  {
    name: 'GeoNames TH.zip',
    url: 'https://download.geonames.org/export/dump/TH.zip',
    path: join(dataDir, 'TH.zip'),
  },
  {
    name: 'Thailand OSM PBF',
    url: 'https://download.geofabrik.de/asia/thailand-latest.osm.pbf',
    path: join(dataDir, 'thailand-latest.osm.pbf'),
  },
  {
    name: 'Wikipedia langlinks SQL',
    url: 'https://dumps.wikimedia.org/thwiki/latest/thwiki-latest-langlinks.sql.gz',
    path: join(dataDir, 'thwiki-latest-langlinks.sql.gz'),
    optional: true,
  },
  {
    name: 'Wikipedia page SQL',
    url: 'https://dumps.wikimedia.org/thwiki/latest/thwiki-latest-page.sql.gz',
    path: join(dataDir, 'thwiki-latest-page.sql.gz'),
    optional: true,
  },
];

const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

function isRecent(filePath) {
  if (!existsSync(filePath)) return false;
  const stats = statSync(filePath);
  return Date.now() - stats.mtimeMs < MAX_AGE_MS;
}

async function download(url, destPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  const writer = createWriteStream(destPath);
  let downloaded = 0;

  const reader = Readable.fromWeb(response.body);
  reader.on('data', (chunk) => {
    downloaded += chunk.length;
    if (totalBytes > 0) {
      const pct = ((downloaded / totalBytes) * 100).toFixed(1);
      const mb = (downloaded / 1024 / 1024).toFixed(1);
      process.stderr.write(`  ${mb}MB / ${(totalBytes / 1024 / 1024).toFixed(1)}MB (${pct}%)\r`);
    }
  });

  await pipeline(reader, writer);
  process.stderr.write('\n');
}

// Ensure data directory exists
mkdirSync(dataDir, { recursive: true });

for (const { name, url, path, optional } of DOWNLOADS) {
  if (!force && isRecent(path)) {
    console.error(`${name}: skipping (file < 24h old, use --force to re-download)`);
    continue;
  }

  console.error(`${name}: downloading from ${url}`);
  try {
    await download(url, path);
    const size = (statSync(path).size / 1024 / 1024).toFixed(1);
    console.error(`${name}: saved ${size}MB to ${path}`);
  } catch (err) {
    if (optional) {
      console.error(`${name}: download failed (${err.message}) — skipping (optional)`);
    } else {
      throw err;
    }
  }
}

console.error('Done.');
