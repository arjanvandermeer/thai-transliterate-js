import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bestMatch } from '../src/matcher.js';

describe('bestMatch', () => {
  const variants = [
    { text: 'krung', weight: 1.0 },
    { text: 'grung', weight: 0.6 },
    { text: 'kroong', weight: 0.3 },
  ];

  it('returns the best match for an exact variant', () => {
    const result = bestMatch(variants, 'krung');
    assert.equal(result.variant, 'krung');
    assert.equal(result.distance, 0);
    assert.equal(result.weight, 1.0);
  });

  it('returns null for empty variants array', () => {
    const result = bestMatch([], 'test');
    assert.equal(result, null);
  });

  it('returns a match for a close target', () => {
    const result = bestMatch(variants, 'krungs');
    assert.ok(result);
    assert.equal(result.variant, 'krung');
    assert.equal(result.distance, 1);
  });

  it('combines similarity and weight in the score', () => {
    // For an exact match: similarity=1, score = 1*0.7 + weight*0.3
    const result = bestMatch(variants, 'krung');
    const expectedScore = 1.0 * 0.7 + 1.0 * 0.3;
    assert.ok(Math.abs(result.score - expectedScore) < 0.001);
  });

  it('higher-weighted variants score above lower-weighted on exact match', () => {
    const mixed = [
      { text: 'same', weight: 0.2 },
      { text: 'same', weight: 0.9 },
    ];
    const result = bestMatch(mixed, 'same');
    // Second variant has higher weight, so it should win
    assert.equal(result.weight, 0.9);
  });

  it('filters by maxDistance', () => {
    const result = bestMatch(variants, 'xyz', { maxDistance: 1 });
    assert.equal(result, null);
  });

  it('allows results within maxDistance', () => {
    const result = bestMatch(variants, 'krun', { maxDistance: 2 });
    assert.ok(result);
    assert.ok(result.distance <= 2);
  });

  it('handles case-insensitive matching', () => {
    const result = bestMatch(variants, 'KRUNG');
    assert.ok(result);
    assert.equal(result.distance, 0);
  });

  it('trims whitespace from target', () => {
    const result = bestMatch(variants, '  krung  ');
    assert.ok(result);
    assert.equal(result.distance, 0);
  });

  it('handles single variant', () => {
    const single = [{ text: 'test', weight: 0.5 }];
    const result = bestMatch(single, 'test');
    assert.ok(result);
    assert.equal(result.variant, 'test');
  });

  it('returns correct score formula: similarity * 0.7 + weight * 0.3', () => {
    // Target 'grung' should exactly match variant with weight 0.6
    const result = bestMatch(variants, 'grung');
    const expectedScore = 1.0 * 0.7 + 0.6 * 0.3;
    assert.ok(Math.abs(result.score - expectedScore) < 0.001);
  });
});
