import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein } from '../src/levenshtein.js';

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    assert.equal(levenshtein('hello', 'hello'), 0);
  });

  it('returns length for empty vs non-empty', () => {
    assert.equal(levenshtein('', 'abc'), 3);
    assert.equal(levenshtein('abc', ''), 3);
  });

  it('returns 0 for two empty strings', () => {
    assert.equal(levenshtein('', ''), 0);
  });

  it('handles single character differences', () => {
    assert.equal(levenshtein('cat', 'bat'), 1);    // substitution
    assert.equal(levenshtein('cat', 'cats'), 1);   // insertion
    assert.equal(levenshtein('cats', 'cat'), 1);   // deletion
  });

  it('handles multiple differences', () => {
    assert.equal(levenshtein('kitten', 'sitting'), 3);
    assert.equal(levenshtein('ramintra', 'ramindra'), 1);
  });

  it('is case-sensitive', () => {
    assert.equal(levenshtein('Hello', 'hello'), 1);
  });

  it('handles Thai romanization variants', () => {
    assert.equal(levenshtein('phuket', 'puket'), 1);
    assert.equal(levenshtein('chiangmai', 'chiang mai'), 1);
    assert.equal(levenshtein('krungthep', 'krung thep'), 1);
  });
});
