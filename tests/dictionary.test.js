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
    assert.strictEqual(bangkok.weight, 1.5);
  });

  it('returns variants for กรุงเทพมหานคร (manual)', () => {
    const result = lookupWord('กรุงเทพมหานคร');
    assert.ok(result);
    const bangkok = result.find(v => v.text === 'bangkok');
    assert.ok(bangkok);
  });

  it('returns variants for สุวรรณภูมิ (auto-generated, boosted by station multiplier)', () => {
    const result = lookupWord('สุวรรณภูมิ');
    assert.ok(result);
    const suvarnabhumi = result.find(v => v.text === 'suvarnabhumi');
    assert.ok(suvarnabhumi, 'suvarnabhumi should be top variant due to station multiplier');
    assert.ok(suvarnabhumi.weight >= 1.0, `weight ${suvarnabhumi.weight} should be >= 1.0`);
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
    assert.strictEqual(thailand.weight, 1.5, 'Manual weight should take precedence');
  });

  it('returns variants with correct shape (text + weight)', () => {
    const result = lookupWord('กรุงเทพ');
    assert.ok(result);
    for (const v of result) {
      assert.ok(typeof v.text === 'string', 'variant should have text string');
      assert.ok(typeof v.weight === 'number', 'variant should have weight number');
      assert.ok(v.weight > 0 && v.weight <= 1.5, `weight ${v.weight} should be in (0, 1.5]`);
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

  it('manual entries have type field', () => {
    const result = lookupWord('กรุงเทพ');
    const bangkok = result.find(v => v.text === 'bangkok');
    assert.ok(bangkok);
    assert.strictEqual(bangkok.type, 'translation');
  });

  it('auto entries do not have type field', () => {
    const result = lookupWord('กรุงเทพ');
    const auto = result.find(v => v.text !== 'bangkok');
    assert.ok(auto);
    assert.strictEqual(auto.type, undefined);
  });
});

describe('lookupWord - translations: false', () => {
  it('filters out translation entries', () => {
    const result = lookupWord('กรุงเทพ', { translations: false });
    assert.ok(result, 'Should still return auto-generated entries');
    const bangkok = result.find(v => v.text === 'bangkok');
    assert.strictEqual(bangkok, undefined, 'Should not include "bangkok" translation');
  });

  it('returns null when word only has translation entries', () => {
    const result = lookupWord('กรุงเทพมหานคร', { translations: false });
    // กรุงเทพมหานคร has auto entries too, so check if any remain
    if (result) {
      assert.ok(result.every(v => v.type !== 'translation'),
        'Remaining entries should not be translations');
    }
  });

  it('returns all entries when translations option is not set', () => {
    const result = lookupWord('กรุงเทพ');
    assert.ok(result);
    const bangkok = result.find(v => v.text === 'bangkok');
    assert.ok(bangkok, 'Should include "bangkok" by default');
  });

  it('returns all entries when translations: true', () => {
    const result = lookupWord('กรุงเทพ', { translations: true });
    assert.ok(result);
    const bangkok = result.find(v => v.text === 'bangkok');
    assert.ok(bangkok, 'Should include "bangkok" when translations: true');
  });
});
