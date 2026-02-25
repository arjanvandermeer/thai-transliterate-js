import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isHoNam, isONam, HO_NAM_FOLLOWERS } from '../src/tables/special-rules.js';

describe('HO_NAM_FOLLOWERS', () => {
  it('is a Set containing the expected consonants', () => {
    assert.ok(HO_NAM_FOLLOWERS instanceof Set);
    const expected = ['ง', 'ญ', 'น', 'ม', 'ย', 'ร', 'ล', 'ว'];
    for (const c of expected) {
      assert.ok(HO_NAM_FOLLOWERS.has(c), `expected ${c} in HO_NAM_FOLLOWERS`);
    }
  });
});

describe('isHoNam', () => {
  it('returns true for ห followed by low-class consonants', () => {
    assert.equal(isHoNam('ห', 'น'), true);
    assert.equal(isHoNam('ห', 'ม'), true);
    assert.equal(isHoNam('ห', 'ง'), true);
    assert.equal(isHoNam('ห', 'ย'), true);
    assert.equal(isHoNam('ห', 'ร'), true);
    assert.equal(isHoNam('ห', 'ล'), true);
    assert.equal(isHoNam('ห', 'ว'), true);
    assert.equal(isHoNam('ห', 'ญ'), true);
  });

  it('returns false for ห followed by non-ho-nam consonants', () => {
    assert.equal(isHoNam('ห', 'ก'), false);
    assert.equal(isHoNam('ห', 'ด'), false);
    assert.equal(isHoNam('ห', 'บ'), false);
  });

  it('returns false when leader is not ห', () => {
    assert.equal(isHoNam('ก', 'น'), false);
    assert.equal(isHoNam('อ', 'น'), false);
  });

  it('returns false for empty strings', () => {
    assert.equal(isHoNam('', ''), false);
    assert.equal(isHoNam('ห', ''), false);
    assert.equal(isHoNam('', 'น'), false);
  });
});

describe('isONam', () => {
  it('returns true for อ + ย', () => {
    assert.equal(isONam('อ', 'ย'), true);
  });

  it('returns false for อ + other consonants', () => {
    assert.equal(isONam('อ', 'น'), false);
    assert.equal(isONam('อ', 'ก'), false);
    assert.equal(isONam('อ', 'ม'), false);
  });

  it('returns false when leader is not อ', () => {
    assert.equal(isONam('ก', 'ย'), false);
    assert.equal(isONam('ห', 'ย'), false);
  });

  it('returns false for empty strings', () => {
    assert.equal(isONam('', ''), false);
    assert.equal(isONam('อ', ''), false);
  });
});
