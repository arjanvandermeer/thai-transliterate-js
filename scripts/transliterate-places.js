#!/usr/bin/env node
/**
 * Transliterate Thai names from a JSON data file and output word-by-word results.
 *
 * Usage: node scripts/transliterate-places.js [--input FILE] [--max-variants N] [--json]
 *
 * Input file should have a "places" or "entries" array of {thai, category} objects.
 * Defaults to data/thai-places.json.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transliterateWords } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse args
const args = process.argv.slice(2);
function argValue(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : fallback;
}
const dataPath = argValue('--input', join(__dirname, '..', 'data', 'thai-places.json'));
const jsonMode = args.includes('--json');
const maxIdx = args.indexOf('--max-variants');
const maxVariants = maxIdx !== -1 ? parseInt(args[maxIdx + 1], 10) : 5;

const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
const places = data.places || data.entries;

if (jsonMode) {
  const results = [];
  for (const place of places) {
    const words = transliterateWords(place.thai, { maxVariants });
    results.push({
      thai: place.thai,
      category: place.category,
      words: words.map(w => ({
        thai: w.thai,
        variants: w.variants.slice(0, maxVariants).map(v => ({
          text: v.text,
          weight: Math.round(v.weight * 100) / 100,
        })),
      })),
    });
  }
  process.stdout.write(JSON.stringify(results, null, 2) + '\n');
} else {
  for (const place of places) {
    const words = transliterateWords(place.thai, { maxVariants });
    const top = words.map(w => w.variants[0]?.text ?? '?').join(' ');
    const wordDetail = words.map(w => {
      const variants = w.variants.slice(0, maxVariants).map(v => `${v.text}(${v.weight.toFixed(2)})`).join(', ');
      return `  ${w.thai}: ${variants}`;
    }).join('\n');
    console.log(`${place.thai}  →  ${top}`);
    console.log(wordDetail);
    console.log();
  }
}
