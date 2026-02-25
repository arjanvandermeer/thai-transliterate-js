import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchThai, transliterateWords } from '../src/index.js';

const ENTITIES_PATH = new URL('../data/thai-entities.json', import.meta.url);
const OUTPUT_PATH = new URL('../data/thai-entities-output.json', import.meta.url);

const entitiesData = JSON.parse(readFileSync(ENTITIES_PATH, 'utf-8'));
const entities = entitiesData.entries;
const outputData = JSON.parse(readFileSync(OUTPUT_PATH, 'utf-8'));
const output = outputData.results || outputData;

/**
 * Curated set of well-known Thai entities with expected English romanizations.
 * maxDistance values allow for legitimate variant spellings.
 */
const EXPECTED_ROMANIZATIONS = [
  // Food
  { thai: 'ผัดไทย', expected: 'pad thai', maxDistance: 3 },
  { thai: 'ต้มยำกุ้ง', expected: 'tom yam kung', maxDistance: 3 },
  { thai: 'ส้มตำ', expected: 'som tam', maxDistance: 2 },
  { thai: 'ลาบ', expected: 'lap', maxDistance: 1 },
  { thai: 'ข้าวผัด', expected: 'khao phat', maxDistance: 3 },
  { thai: 'ข้าวซอย', expected: 'khao soi', maxDistance: 2 },

  // Culture
  { thai: 'สงกรานต์', expected: 'songkran', maxDistance: 2 },
  { thai: 'ลอยกระทง', expected: 'loi krathong', maxDistance: 3 },
  { thai: 'โขน', expected: 'khon', maxDistance: 0 },
  { thai: 'สบาย', expected: 'sabai', maxDistance: 1 },
  { thai: 'กระทง', expected: 'krathong', maxDistance: 1 },

  // Sport
  { thai: 'มวยไทย', expected: 'muay thai', maxDistance: 5 },
  { thai: 'มงคล', expected: 'mongkhon', maxDistance: 2 },

  // People
  { thai: 'นเรศวร', expected: 'naresuan', maxDistance: 3 },
  { thai: 'สุริโยทัย', expected: 'suriyothai', maxDistance: 3 },
  { thai: 'แสนชัย', expected: 'saenchai', maxDistance: 2 },
];

describe('thai-entities regression - known romanizations', () => {
  for (const tc of EXPECTED_ROMANIZATIONS) {
    it(`${tc.thai} → ${tc.expected} (max dist: ${tc.maxDistance})`, () => {
      const match = matchThai(tc.thai, tc.expected, { maxVariants: 30 });
      assert.ok(match, `Should find a match for ${tc.thai} → ${tc.expected}`);
      assert.ok(match.distance <= tc.maxDistance,
        `Distance ${match.distance} > max ${tc.maxDistance} for ${tc.thai} → ${tc.expected} (got: "${match.variant}")`);
    });
  }
});

describe('thai-entities regression - output consistency', () => {
  it('output.json has same number of entries as entities.json', () => {
    assert.strictEqual(output.length, entities.length,
      `Output has ${output.length} entries, entities has ${entities.length}`);
  });

  it('output.json entries preserve Thai text and category', () => {
    for (let i = 0; i < entities.length; i++) {
      assert.strictEqual(output[i].thai, entities[i].thai,
        `Entry ${i}: Thai text mismatch`);
      assert.strictEqual(output[i].category, entities[i].category,
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
    const sampleIndices = [0, 10, 20, 40, 60, 80];
    for (const idx of sampleIndices) {
      if (idx >= entities.length) continue;
      const entity = entities[idx];
      const current = transliterateWords(entity.thai, { maxVariants: 5 });
      const saved = output[idx];

      for (let w = 0; w < Math.min(current.length, saved.words.length); w++) {
        assert.strictEqual(current[w].variants[0].text, saved.words[w].variants[0].text,
          `${entity.thai} word ${w}: top variant changed from "${saved.words[w].variants[0].text}" to "${current[w].variants[0].text}"`);
      }
    }
  });
});
