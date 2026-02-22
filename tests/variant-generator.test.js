import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateVariants } from '../src/variant-generator.js';

describe('generateVariants - single syllable', () => {
  it('generates variants from one position array', () => {
    const syllablePositions = [
      [
        [{ text: 'k', weight: 1.0 }, { text: 'g', weight: 0.6 }],
        [{ text: 'a', weight: 1.0 }],
      ],
    ];
    const result = generateVariants(syllablePositions);
    assert.ok(result.length > 0);
    const texts = result.map(v => v.text);
    assert.ok(texts.includes('ka'));
    assert.ok(texts.includes('ga'));
  });

  it('returns results sorted by weight descending', () => {
    const syllablePositions = [
      [
        [{ text: 'k', weight: 1.0 }, { text: 'g', weight: 0.6 }],
        [{ text: 'a', weight: 1.0 }],
      ],
    ];
    const result = generateVariants(syllablePositions);
    for (let i = 1; i < result.length; i++) {
      assert.ok(result[i].weight <= result[i - 1].weight,
        `Weight at ${i} (${result[i].weight}) > weight at ${i - 1} (${result[i - 1].weight})`);
    }
  });
});

describe('generateVariants - multi-syllable', () => {
  it('combines variants across syllables', () => {
    const syllablePositions = [
      [[{ text: 'k', weight: 1.0 }], [{ text: 'a', weight: 1.0 }]],
      [[{ text: 'n', weight: 1.0 }], [{ text: 'a', weight: 1.0 }]],
    ];
    const result = generateVariants(syllablePositions);
    const texts = result.map(v => v.text);
    assert.ok(texts.includes('kana'));
  });
});

describe('generateVariants - options', () => {
  it('respects maxVariants', () => {
    const syllablePositions = [
      [
        [{ text: 'k', weight: 1.0 }, { text: 'g', weight: 0.6 }, { text: 'c', weight: 0.3 }],
        [{ text: 'a', weight: 1.0 }, { text: 'aa', weight: 0.5 }],
      ],
    ];
    const result = generateVariants(syllablePositions, { maxVariants: 2 });
    assert.ok(result.length <= 2);
  });

  it('respects minWeight threshold', () => {
    const syllablePositions = [
      [
        [{ text: 'k', weight: 1.0 }, { text: 'x', weight: 0.001 }],
        [{ text: 'a', weight: 1.0 }],
      ],
    ];
    const result = generateVariants(syllablePositions, { minWeight: 0.01 });
    const texts = result.map(v => v.text);
    assert.ok(!texts.includes('xa'),
      'Should prune variants below minWeight');
  });
});

describe('generateVariants - dedup', () => {
  it('deduplicates identical variant strings (case-insensitive)', () => {
    const syllablePositions = [
      [
        [{ text: 's', weight: 1.0 }, { text: 's', weight: 0.8 }],
        [{ text: 'a', weight: 1.0 }],
      ],
    ];
    const result = generateVariants(syllablePositions);
    const saCount = result.filter(v => v.text.toLowerCase() === 'sa').length;
    assert.strictEqual(saCount, 1, 'Should deduplicate identical strings');
  });

  it('keeps the highest weight when deduplicating', () => {
    const syllablePositions = [
      [
        [{ text: 's', weight: 1.0 }, { text: 's', weight: 0.5 }],
        [{ text: 'a', weight: 1.0 }],
      ],
    ];
    const result = generateVariants(syllablePositions);
    const sa = result.find(v => v.text === 'sa');
    assert.ok(sa);
    assert.strictEqual(sa.weight, 1.0, 'Should keep the higher weight');
  });
});

describe('generateVariants - compact variants', () => {
  it('adds space-removed variants when text contains spaces', () => {
    // Craft input where position text itself contains a space
    const syllablePositions = [
      [[{ text: 'k a', weight: 1.0 }, { text: 'ka', weight: 0.8 }]],
    ];
    const result = generateVariants(syllablePositions);
    const texts = result.map(v => v.text);
    assert.ok(texts.includes('k a'), 'Should include original spaced variant');
    assert.ok(texts.includes('ka'), 'Should include compact variant');
  });

  it('applies 0.9 weight factor to compact variants', () => {
    const syllablePositions = [
      [[{ text: 'k a', weight: 1.0 }]],
    ];
    const result = generateVariants(syllablePositions);
    const compact = result.find(v => v.text === 'ka');
    assert.ok(compact, 'Should have compact variant');
    assert.strictEqual(compact.weight, 0.9);
  });

  it('deduplicates after adding compact variants', () => {
    // 'ka' exists both as original and as compact of 'k a'
    const syllablePositions = [
      [[{ text: 'k a', weight: 1.0 }, { text: 'ka', weight: 0.5 }]],
    ];
    const result = generateVariants(syllablePositions);
    const kaCount = result.filter(v => v.text === 'ka').length;
    assert.strictEqual(kaCount, 1, 'Should deduplicate compact and original');
    // Should keep the higher weight (0.9 from compact)
    const ka = result.find(v => v.text === 'ka');
    assert.strictEqual(ka.weight, 0.9);
  });

  it('skips compact variants when includeCompact is false', () => {
    const syllablePositions = [
      [[{ text: 'k a', weight: 1.0 }]],
    ];
    const result = generateVariants(syllablePositions, { includeCompact: false });
    const texts = result.map(v => v.text);
    assert.ok(texts.includes('k a'));
    assert.ok(!texts.includes('ka'), 'Should not add compact when disabled');
  });

  it('does not add compacts when no variants contain spaces', () => {
    const syllablePositions = [
      [[{ text: 'ka', weight: 1.0 }]],
    ];
    const result = generateVariants(syllablePositions);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].text, 'ka');
  });
});

describe('generateVariants - edge cases', () => {
  it('handles empty input', () => {
    const result = generateVariants([]);
    assert.deepStrictEqual(result, []);
  });

  it('handles single-variant positions', () => {
    const syllablePositions = [
      [[{ text: 'a', weight: 1.0 }]],
    ];
    const result = generateVariants(syllablePositions);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].text, 'a');
    assert.strictEqual(result[0].weight, 1.0);
  });
});
