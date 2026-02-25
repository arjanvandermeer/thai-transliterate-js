import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONSONANTS, VOWEL_PATTERNS, THOR_SO_VARIANTS, THOR_SO_VARIANTS_MEDIAL, SOR_RO_VARIANTS } from '../src/tables/load-weights.js';

describe('load-weights - base table integrity', () => {
  it('exports all 44 consonants', () => {
    const count = Object.keys(CONSONANTS).length;
    assert.strictEqual(count, 44, `Expected 44 consonants, got ${count}`);
  });

  it('every consonant has initial and final arrays', () => {
    for (const [char, entry] of Object.entries(CONSONANTS)) {
      assert.ok(Array.isArray(entry.initial), `${char} missing initial array`);
      assert.ok(Array.isArray(entry.final), `${char} missing final array`);
      assert.ok(entry.initial.length > 0, `${char} initial array is empty`);
    }
  });

  it('every consonant variant has text and weight', () => {
    for (const [char, entry] of Object.entries(CONSONANTS)) {
      for (const v of entry.initial) {
        assert.ok(typeof v.text === 'string', `${char} initial variant missing text`);
        assert.ok(typeof v.weight === 'number', `${char} initial variant missing weight`);
      }
      for (const v of entry.final) {
        assert.ok(typeof v.text === 'string', `${char} final variant missing text`);
        assert.ok(typeof v.weight === 'number', `${char} final variant missing weight`);
      }
    }
  });

  it('exports vowel patterns', () => {
    const count = Object.keys(VOWEL_PATTERNS).length;
    assert.ok(count >= 20, `Expected at least 20 vowel patterns, got ${count}`);
  });

  it('exports THOR_SO_VARIANTS array', () => {
    assert.ok(Array.isArray(THOR_SO_VARIANTS));
    assert.ok(THOR_SO_VARIANTS.length > 0);
  });

  it('exports SOR_RO_VARIANTS array', () => {
    assert.ok(Array.isArray(SOR_RO_VARIANTS));
    assert.ok(SOR_RO_VARIANTS.length > 0);
  });
});

describe('load-weights - weight-overrides applied', () => {
  it('applies implied_o override: a weight reduced by blending', () => {
    const impliedO = VOWEL_PATTERNS.implied_o;
    assert.ok(impliedO, 'implied_o pattern should exist');
    const aVariant = impliedO.variants.find(v => v.text === 'a');
    assert.ok(aVariant, 'implied_o should have "a" variant');
    assert.ok(aVariant.weight < 0.5, `a weight should be reduced from base 0.5, got ${aVariant.weight}`);
  });

  it('applies sara_o override: oh weight reduced by blending', () => {
    const saraO = VOWEL_PATTERNS.sara_o;
    assert.ok(saraO, 'sara_o pattern should exist');
    const ohVariant = saraO.variants.find(v => v.text === 'oh');
    assert.ok(ohVariant, 'sara_o should have "oh" variant');
    assert.ok(ohVariant.weight < 0.3, `oh weight should be reduced from base 0.3, got ${ohVariant.weight}`);
  });

  it('applies implied_a override: o weight reduced by blending', () => {
    const impliedA = VOWEL_PATTERNS.implied_a;
    assert.ok(impliedA, 'implied_a pattern should exist');
    const oVariant = impliedA.variants.find(v => v.text === 'o');
    assert.ok(oVariant, 'implied_a should have "o" variant');
    assert.ok(oVariant.weight < 0.4, `o weight should be reduced from base 0.4, got ${oVariant.weight}`);
  });

  it('applies sara_ua override: uar weight reduced by blending', () => {
    const saraUa = VOWEL_PATTERNS.sara_ua;
    assert.ok(saraUa, 'sara_ua pattern should exist');
    const uarVariant = saraUa.variants.find(v => v.text === 'uar');
    assert.ok(uarVariant, 'sara_ua should have "uar" variant');
    assert.ok(uarVariant.weight < 0.3, `uar weight should be reduced from base 0.3, got ${uarVariant.weight}`);
  });

  it('applies ทร cluster override: s weight boosted by blending', () => {
    const sVariant = THOR_SO_VARIANTS.find(v => v.text === 's');
    assert.ok(sVariant, 'THOR_SO_VARIANTS should have "s" variant');
    assert.ok(sVariant.weight > 0.4, `s weight should be boosted from base 0.4, got ${sVariant.weight}`);
  });

  it('medial ทร ranks "tr" above "thr"', () => {
    const tr = THOR_SO_VARIANTS_MEDIAL.find(v => v.text === 'tr');
    const thr = THOR_SO_VARIANTS_MEDIAL.find(v => v.text === 'thr');
    assert.ok(tr, 'medial ทร should have "tr"');
    assert.ok(thr, 'medial ทร should have "thr"');
    assert.ok(tr.weight > thr.weight, `"tr" (${tr.weight}) should outweigh "thr" (${thr.weight})`);
  });

  it('medial ทร excludes "s" variant', () => {
    const s = THOR_SO_VARIANTS_MEDIAL.find(v => v.text === 's');
    assert.ok(!s, 'medial ทร should not include "s"');
  });

  it('does not modify un-overridden vowel variants', () => {
    // sara_e has no overrides — should retain base weights
    const saraE = VOWEL_PATTERNS.sara_e;
    assert.ok(saraE, 'sara_e pattern should exist');
    const eVariant = saraE.variants.find(v => v.text === 'e');
    assert.ok(eVariant);
    assert.strictEqual(eVariant.weight, 1.0, 'sara_e "e" should keep base weight 1.0');
  });

  it('consonants with no overrides retain base weights', () => {
    // ก should have k=1.0 initial (no consonant overrides exist)
    const ko = CONSONANTS['ก'];
    assert.ok(ko);
    const kInitial = ko.initial.find(v => v.text === 'k');
    assert.ok(kInitial);
    assert.strictEqual(kInitial.weight, 1.0);
  });
});
