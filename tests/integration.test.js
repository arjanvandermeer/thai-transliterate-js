import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transliterate, transliterateWords, matchThai } from '../src/index.js';

describe('transliterate', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(transliterate(''), []);
    assert.deepEqual(transliterate(null), []);
  });

  it('returns variants sorted by weight descending', () => {
    const result = transliterate('กา');
    assert.ok(result.length > 0);
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i].weight <= result[i - 1].weight,
        `variant ${i} weight ${result[i].weight} should be <= ${result[i - 1].weight}`);
    }
  });

  it('respects maxVariants option', () => {
    const result = transliterate('กรุงเทพ', { maxVariants: 3 });
    assert.ok(result.length <= 3);
  });

  it('passes through non-Thai text', () => {
    const result = transliterate('hello');
    assert.equal(result.length, 1);
    assert.equal(result[0].text, 'hello');
  });
});

describe('transliterate - place names', () => {
  const testCases = [
    {
      thai: 'ภูเก็ต',
      expected: 'phuket',
      maxDistance: 0,
      description: 'Phuket',
    },
    {
      thai: 'เชียงใหม่',
      expected: 'chiang mai',
      maxDistance: 2,
      description: 'Chiang Mai',
    },
    {
      thai: 'กรุงเทพ',
      expected: 'krung thep',
      maxDistance: 2,
      description: 'Krung Thep',
    },
    {
      thai: 'ทราย',
      expected: 'sai',
      maxDistance: 0,
      description: 'Sai (sand)',
    },
    {
      thai: 'หาดใหญ่',
      expected: 'hat yai',
      maxDistance: 2,
      description: 'Hat Yai',
    },
    {
      thai: 'รามอินทรา',
      expected: 'ramintra',
      maxDistance: 2,
      description: 'Ramintra',
    },
  ];

  for (const tc of testCases) {
    it(`transliterates ${tc.description} (${tc.thai})`, () => {
      const match = matchThai(tc.thai, tc.expected, { maxVariants: 30 });
      assert.ok(match, `Should find a match for ${tc.thai}`);
      assert.ok(match.distance <= tc.maxDistance,
        `Distance ${match.distance} > max ${tc.maxDistance} for ${tc.thai} → ${tc.expected} (got: ${match.variant})`);
    });
  }
});

describe('transliterate - variant generation', () => {
  it('generates both RTGS and informal variants for ก', () => {
    const result = transliterate('กา');
    const texts = result.map(v => v.text);
    assert.ok(texts.includes('ka'), 'Should include RTGS "ka"');
    assert.ok(texts.includes('ga'), 'Should include informal "ga"');
  });

  it('generates aspirated and non-aspirated variants', () => {
    const result = transliterate('ขา');
    const texts = result.map(v => v.text);
    assert.ok(texts.includes('kha'), 'Should include RTGS "kha"');
    assert.ok(texts.includes('ka'), 'Should include informal "ka"');
  });

  it('generates ทร→s variant', () => {
    const result = transliterate('ทราย', { maxVariants: 10 });
    const texts = result.map(v => v.text);
    assert.ok(texts.includes('sai'), 'Should include "sai" (ทร→s)');
  });

  it('handles ho-nam correctly', () => {
    // หม in ใหม่ - ห is silent, ม is the real initial
    const result = transliterate('หมา');
    const texts = result.map(v => v.text);
    assert.ok(texts.some(t => t.startsWith('m')),
      `Should start with 'm' (ho-nam), got: ${texts.join(', ')}`);
  });
});

describe('matchThai', () => {
  it('returns exact match with distance 0', () => {
    const result = matchThai('ภูเก็ต', 'phuket');
    assert.ok(result);
    assert.equal(result.distance, 0);
  });

  it('finds close match for common spelling variants', () => {
    const result = matchThai('เชียงใหม่', 'chiangmai');
    assert.ok(result);
    assert.ok(result.distance <= 1);
  });

  it('returns null when no match within maxDistance', () => {
    const result = matchThai('ภูเก็ต', 'completely different', { maxDistance: 2 });
    assert.equal(result, null);
  });
});

describe('transliterateWords', () => {
  it('returns empty array for empty input', () => {
    assert.deepEqual(transliterateWords(''), []);
    assert.deepEqual(transliterateWords(null), []);
  });

  it('returns word objects with thai and variants fields', () => {
    const result = transliterateWords('กา');
    assert.ok(result.length > 0);
    assert.ok(result[0].thai, 'Should have thai field');
    assert.ok(Array.isArray(result[0].variants), 'Should have variants array');
    assert.ok(result[0].variants.length > 0, 'Should have at least one variant');
    assert.ok(result[0].variants[0].text, 'Variant should have text');
    assert.ok(typeof result[0].variants[0].weight === 'number', 'Variant should have weight');
  });

  it('preserves original Thai word in each entry', () => {
    const result = transliterateWords('ภูเก็ต');
    assert.equal(result.length, 1);
    assert.equal(result[0].thai, 'ภูเก็ต');
  });

  it('splits compound names into separate word entries', () => {
    const result = transliterateWords('วงแหวนรามอินทรา');
    assert.ok(result.length >= 2, `Expected at least 2 words, got ${result.length}: ${result.map(w => w.thai).join(', ')}`);
  });

  it('splits prefix + name into separate entries', () => {
    const result = transliterateWords('ถนนสุขุมวิท');
    assert.ok(result.length >= 2, `Expected at least 2 words, got ${result.length}: ${result.map(w => w.thai).join(', ')}`);
    assert.equal(result[0].thai, 'ถนน');
  });

  it('variants per word are sorted by weight descending', () => {
    const result = transliterateWords('ภูเก็ต');
    const variants = result[0].variants;
    for (let i = 1; i < variants.length; i++) {
      assert.ok(variants[i].weight <= variants[i - 1].weight,
        `variant ${i} weight ${variants[i].weight} should be <= ${variants[i - 1].weight}`);
    }
  });

  it('passes through non-Thai text with thai field set', () => {
    const result = transliterateWords('hello');
    assert.equal(result.length, 1);
    assert.equal(result[0].thai, 'hello');
    assert.equal(result[0].variants[0].text, 'hello');
    assert.equal(result[0].variants[0].weight, 1.0);
  });

  it('respects maxVariants option per word', () => {
    const result = transliterateWords('กรุงเทพ', { maxVariants: 3 });
    for (const word of result) {
      assert.ok(word.variants.length <= 3);
    }
  });
});

describe('transliterate - does not crash on long words', () => {
  it('handles นครราชสีมา without OOM', () => {
    const result = transliterate('นครราชสีมา', { maxVariants: 10 });
    assert.ok(result.length > 0);
    assert.ok(result.length <= 10);
  });

  it('handles สุวรรณภูมิ', () => {
    const result = transliterate('สุวรรณภูมิ', { maxVariants: 10 });
    assert.ok(result.length > 0);
  });

  it('handles สมุทรปราการ', () => {
    const result = transliterate('สมุทรปราการ', { maxVariants: 10 });
    assert.ok(result.length > 0);
  });
});
