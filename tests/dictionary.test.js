import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { lookupWord } from '../src/dictionary.js';

describe('lookupWord', () => {
  it('returns variants for a manual dictionary entry', () => {
    const result = lookupWord('กรุงเทพ');
    assert.ok(result, 'กรุงเทพ should be in dictionary');
    assert.ok(Array.isArray(result));
    const bangkok = result.find(v => v.text === 'bangkok');
    assert.ok(bangkok, 'Should include bangkok variant');
    assert.strictEqual(bangkok.weight, 0.9);
  });

  it('returns variants for กรุงเทพมหานคร (manual)', () => {
    const result = lookupWord('กรุงเทพมหานคร');
    assert.ok(result);
    const bangkok = result.find(v => v.text === 'bangkok');
    assert.ok(bangkok);
  });

  it('returns variants for สุวรรณภูมิ (manual)', () => {
    const result = lookupWord('สุวรรณภูมิ');
    assert.ok(result);
    const suvarnabhumi = result.find(v => v.text === 'suvarnabhumi');
    assert.ok(suvarnabhumi);
    assert.strictEqual(suvarnabhumi.weight, 0.9);
  });

  it('returns null for unknown word', () => {
    const result = lookupWord('ไม่รู้จักคำนี้');
    assert.strictEqual(result, null);
  });

  it('manual entries take precedence over auto-generated ones', () => {
    // ประเทศไทย is in both auto (various transliterations) and manual (Thailand at 0.9)
    const result = lookupWord('ประเทศไทย');
    assert.ok(result);
    const thailand = result.find(v => v.text === 'thailand');
    assert.ok(thailand, 'Manual "thailand" entry should be present');
    assert.strictEqual(thailand.weight, 0.9, 'Manual weight should take precedence');
  });

  it('returns variants with correct shape (text + weight)', () => {
    const result = lookupWord('กรุงเทพ');
    assert.ok(result);
    for (const v of result) {
      assert.ok(typeof v.text === 'string', 'variant should have text string');
      assert.ok(typeof v.weight === 'number', 'variant should have weight number');
      assert.ok(v.weight > 0 && v.weight <= 1.1, `weight ${v.weight} should be in (0, 1.1]`);
    }
  });

  it('returns auto-generated entry for word not in manual', () => {
    // ประเทศไทย has auto entries like "Prathet Thai" alongside manual "Thailand"
    const result = lookupWord('ประเทศไทย');
    assert.ok(result);
    // Should have more than just the manual entry
    assert.ok(result.length > 1,
      `Expected multiple variants from merged auto+manual, got ${result.length}`);
  });
});
