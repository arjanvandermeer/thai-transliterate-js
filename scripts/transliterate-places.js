#!/usr/bin/env node
/**
 * Transliterate Thai names from a JSON data file and output word-by-word results.
 *
 * Usage: node scripts/transliterate-places.js [--input FILE] [--max-variants N] [--json] [--no-dictionary] [--compare]
 *
 * Input file should have a "places" or "entries" array of {thai, category} objects.
 * Defaults to data/thai-places.json.
 */

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transliterateWords } from '../src/index.js';
import { argValue, hasFlag } from './lib/args.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const dataPath = argValue('--input', join(__dirname, '..', 'data', 'thai-places.json'));
const jsonMode = hasFlag('--json');
const compareMode = hasFlag('--compare');
const noDictionary = hasFlag('--no-dictionary');
const maxVariants = parseInt(argValue('--max-variants', '5'), 10);

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
const gitCommit = execSync('git rev-parse --short HEAD', { cwd: join(__dirname, '..'), encoding: 'utf-8' }).trim();

const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
const places = data.places || data.entries;

const opts = { maxVariants };
if (noDictionary) opts.dictionary = false;

if (compareMode) {
  // Side-by-side: algorithm vs dictionary
  let same = 0;
  let diff = 0;
  for (const place of places) {
    const withDict = transliterateWords(place.thai, { maxVariants });
    const withoutDict = transliterateWords(place.thai, { maxVariants, dictionary: false });
    const topWith = withDict.map(w => w.variants[0]?.text ?? '?').join(' ');
    const topWithout = withoutDict.map(w => w.variants[0]?.text ?? '?').join(' ');
    if (topWith === topWithout) {
      same++;
      console.log(`= ${place.thai}  ${topWithout}`);
    } else {
      diff++;
      console.log(`! ${place.thai}  algo: ${topWithout}  dict: ${topWith}`);
    }
  }
  console.error(`\n${same} same, ${diff} different (${((same / (same + diff)) * 100).toFixed(1)}% algorithm-only match)`);
} else if (jsonMode) {
  const results = [];
  for (const place of places) {
    const words = transliterateWords(place.thai, opts);
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
  const output = {
    _meta: {
      version: pkg.version,
      commit: gitCommit,
      generatedAt: new Date().toISOString(),
      input: dataPath,
      entries: results.length,
      dictionary: !noDictionary,
    },
    results,
  };
  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
} else {
  for (const place of places) {
    const words = transliterateWords(place.thai, opts);
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
