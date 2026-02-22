import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchThai, transliterateWords } from '../src/index.js';

const PLACES_PATH = new URL('../data/thai-places.json', import.meta.url);
const OUTPUT_PATH = new URL('../data/thai-places-output.json', import.meta.url);

const placesData = JSON.parse(readFileSync(PLACES_PATH, 'utf-8'));
const places = placesData.places;
const output = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));

/**
 * Curated set of well-known Thai places with expected English romanizations.
 * maxDistance values are calibrated to the current transliteration output —
 * they should be tight enough to catch regressions but loose enough to
 * accommodate legitimate variant spellings.
 */
const EXPECTED_ROMANIZATIONS = [
  // Provinces
  { thai: 'กระบี่', expected: 'krabi', maxDistance: 0 },
  { thai: 'เชียงใหม่', expected: 'chiang mai', maxDistance: 2 },
  { thai: 'เชียงราย', expected: 'chiang rai', maxDistance: 2 },
  { thai: 'ภูเก็ต', expected: 'phuket', maxDistance: 0 },
  { thai: 'ชลบุรี', expected: 'chonburi', maxDistance: 1 },
  { thai: 'สงขลา', expected: 'songkhla', maxDistance: 1 },
  { thai: 'กรุงเทพมหานคร', expected: 'krungthep mahankhra', maxDistance: 4 },
  { thai: 'นครราชสีมา', expected: 'nakhon ratchasima', maxDistance: 4 },
  { thai: 'สุราษฎร์ธานี', expected: 'surat thani', maxDistance: 4 },
  { thai: 'อุดรธานี', expected: 'udon thani', maxDistance: 4 },

  // BTS stations
  { thai: 'สยาม', expected: 'sayam', maxDistance: 0 },
  { thai: 'อโศก', expected: 'asok', maxDistance: 1 },
  { thai: 'สีลม', expected: 'silom', maxDistance: 0 },
  { thai: 'สะพานตากสิน', expected: 'saphan taksin', maxDistance: 3 },

  // Roads
  { thai: 'สุขุมวิท', expected: 'sukhumvit', maxDistance: 2 },
  { thai: 'รามอินทรา', expected: 'ramintra', maxDistance: 2 },

  // Landmarks / words
  { thai: 'ทราย', expected: 'sai', maxDistance: 0 },
  { thai: 'หาดใหญ่', expected: 'hat yai', maxDistance: 2 },
  { thai: 'ศรี', expected: 'si', maxDistance: 0 },
];

describe('thai-places regression - known romanizations', () => {
  for (const tc of EXPECTED_ROMANIZATIONS) {
    it(`${tc.thai} → ${tc.expected} (max dist: ${tc.maxDistance})`, () => {
      const match = matchThai(tc.thai, tc.expected, { maxVariants: 30 });
      assert.ok(match, `Should find a match for ${tc.thai} → ${tc.expected}`);
      assert.ok(match.distance <= tc.maxDistance,
        `Distance ${match.distance} > max ${tc.maxDistance} for ${tc.thai} → ${tc.expected} (got: "${match.variant}")`);
    });
  }
});

describe('thai-places regression - output consistency', () => {
  it('output.json has same number of entries as places.json', () => {
    assert.strictEqual(output.length, places.length,
      `Output has ${output.length} entries, places has ${places.length}`);
  });

  it('output.json entries preserve Thai text and category', () => {
    for (let i = 0; i < places.length; i++) {
      assert.strictEqual(output[i].thai, places[i].thai,
        `Entry ${i}: Thai text mismatch`);
      assert.strictEqual(output[i].category, places[i].category,
        `Entry ${i}: Category mismatch`);
    }
  });

  it('output.json entries have valid words with variants', () => {
    for (const entry of output) {
      assert.ok(Array.isArray(entry.words),
        `${entry.thai}: missing words array`);
      assert.ok(entry.words.length > 0,
        `${entry.thai}: empty words array`);
      for (const word of entry.words) {
        assert.ok(word.thai, `${entry.thai}: word missing thai field`);
        assert.ok(Array.isArray(word.variants),
          `${entry.thai}: word missing variants array`);
        assert.ok(word.variants.length > 0,
          `${entry.thai}: word has no variants`);
        for (const v of word.variants) {
          assert.ok(typeof v.text === 'string' && v.text.length > 0,
            `${entry.thai}: variant missing text`);
          assert.ok(typeof v.weight === 'number' && v.weight > 0,
            `${entry.thai}: variant missing valid weight`);
        }
      }
    }
  });

  it('output.json matches current transliteration for a sample', () => {
    // Verify a sample of entries still produce the same top variants
    const sampleIndices = [0, 10, 50, 100, 200, 300, 400, 500];
    for (const idx of sampleIndices) {
      if (idx >= places.length) continue;
      const place = places[idx];
      const current = transliterateWords(place.thai, { maxVariants: 5 });
      const saved = output[idx];

      // The top variant for each word should match
      for (let w = 0; w < Math.min(current.length, saved.words.length); w++) {
        assert.strictEqual(current[w].variants[0].text, saved.words[w].variants[0].text,
          `${place.thai} word ${w}: top variant changed from "${saved.words[w].variants[0].text}" to "${current[w].variants[0].text}"`);
      }
    }
  });
});
