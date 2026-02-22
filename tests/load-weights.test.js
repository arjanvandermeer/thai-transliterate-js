import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CONSONANTS, VOWEL_PATTERNS, THOR_SO_VARIANTS, SOR_RO_VARIANTS } from '../src/tables/load-weights.js';

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
  it('applies sara_a override: ar weight = 0.05', () => {
    const saraA = VOWEL_PATTERNS.sara_a;
    assert.ok(saraA, 'sara_a pattern should exist');
    const arVariant = saraA.variants.find(v => v.text === 'ar');
    assert.ok(arVariant, 'sara_a should have "ar" variant');
    assert.strictEqual(arVariant.weight, 0.05, 'ar weight should be overridden to 0.05');
  });

  it('applies implied_o override: o weight = 1', () => {
    const impliedO = VOWEL_PATTERNS.implied_o;
    assert.ok(impliedO, 'implied_o pattern should exist');
    const oVariant = impliedO.variants.find(v => v.text === 'o');
    assert.ok(oVariant, 'implied_o should have "o" variant');
    assert.strictEqual(oVariant.weight, 1, 'o weight should be overridden to 1');
  });

  it('applies sara_o override: oh weight = 0.01', () => {
    const saraO = VOWEL_PATTERNS.sara_o;
    assert.ok(saraO, 'sara_o pattern should exist');
    const ohVariant = saraO.variants.find(v => v.text === 'oh');
    assert.ok(ohVariant, 'sara_o should have "oh" variant');
    assert.strictEqual(ohVariant.weight, 0.01, 'oh weight should be overridden to 0.01');
  });

  it('applies implied_a override: a weight = 1', () => {
    const impliedA = VOWEL_PATTERNS.implied_a;
    assert.ok(impliedA, 'implied_a pattern should exist');
    const aVariant = impliedA.variants.find(v => v.text === 'a');
    assert.ok(aVariant, 'implied_a should have "a" variant');
    assert.strictEqual(aVariant.weight, 1, 'a weight should be overridden to 1');
  });

  it('applies sara_ua override: uar weight = 0.01', () => {
    const saraUa = VOWEL_PATTERNS.sara_ua;
    assert.ok(saraUa, 'sara_ua pattern should exist');
    const uarVariant = saraUa.variants.find(v => v.text === 'uar');
    assert.ok(uarVariant, 'sara_ua should have "uar" variant');
    assert.strictEqual(uarVariant.weight, 0.01, 'uar weight should be overridden to 0.01');
  });

  it('applies ทร cluster override: s weight = 1', () => {
    const sVariant = THOR_SO_VARIANTS.find(v => v.text === 's');
    assert.ok(sVariant, 'THOR_SO_VARIANTS should have "s" variant');
    assert.strictEqual(sVariant.weight, 1, 's weight should be overridden to 1');
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
