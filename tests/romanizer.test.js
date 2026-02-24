import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { romanizeSyllable } from '../src/romanizer.js';

describe('romanizeSyllable - basic consonant + vowel', () => {
  it('romanizes a simple syllable (ก + า)', () => {
    const syllable = {
      initialConsonant: 'ก',
      clusterConsonant: null,
      vowelPattern: 'sara_a',
      finalConsonant: null,
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: false },
    };
    const positions = romanizeSyllable(syllable);
    // Should have initial + vowel positions
    assert.strictEqual(positions.length, 2);
    // Initial: ก → k/g
    const initials = positions[0].map(v => v.text);
    assert.ok(initials.includes('k'));
    assert.ok(initials.includes('g'));
    // Vowel: sara_a → a/aa/ar
    const vowels = positions[1].map(v => v.text);
    assert.ok(vowels.includes('a'));
  });

  it('romanizes syllable with final consonant', () => {
    const syllable = {
      initialConsonant: 'ก',
      clusterConsonant: null,
      vowelPattern: 'mai_han_akat',
      finalConsonant: 'น',
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: false },
    };
    const positions = romanizeSyllable(syllable);
    // Should have initial + vowel + final = 3 positions
    assert.strictEqual(positions.length, 3);
    const finals = positions[2].map(v => v.text);
    assert.ok(finals.includes('n'));
  });
});

describe('romanizeSyllable - clusters', () => {
  it('romanizes consonant cluster (กร)', () => {
    const syllable = {
      initialConsonant: 'ก',
      clusterConsonant: 'ร',
      vowelPattern: 'sara_u_short',
      finalConsonant: 'ง',
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: false },
    };
    const positions = romanizeSyllable(syllable);
    // Should have initial + cluster + vowel + final = 4 positions
    assert.strictEqual(positions.length, 4);
    const clusters = positions[1].map(v => v.text);
    assert.ok(clusters.includes('r'));
  });
});

describe('romanizeSyllable - special flags', () => {
  it('uses THOR_SO_VARIANTS (including "s") for word-initial ทร cluster', () => {
    const syllable = {
      initialConsonant: 'ท',
      clusterConsonant: 'ร',
      vowelPattern: 'sara_ai_malai',
      finalConsonant: null,
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: true, sorRo: false },
      isFirstSyllable: true,
    };
    const positions = romanizeSyllable(syllable);
    const initTexts = positions[0].map(v => v.text);
    assert.ok(initTexts.includes('s'), `Word-initial ทร should include "s", got: ${initTexts.join(', ')}`);
    assert.ok(initTexts.includes('thr'), `Word-initial ทร should include "thr", got: ${initTexts.join(', ')}`);
  });

  it('uses THOR_SO_VARIANTS_MEDIAL (no "s") for mid-word ทร cluster', () => {
    const syllable = {
      initialConsonant: 'ท',
      clusterConsonant: 'ร',
      vowelPattern: 'sara_aa',
      finalConsonant: null,
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: true, sorRo: false },
      isFirstSyllable: false,
    };
    const positions = romanizeSyllable(syllable);
    const initTexts = positions[0].map(v => v.text);
    assert.ok(!initTexts.includes('s'), `Mid-word ทร should NOT include "s", got: ${initTexts.join(', ')}`);
    assert.ok(initTexts.includes('thr'), `Mid-word ทร should include "thr", got: ${initTexts.join(', ')}`);
  });

  it('uses SOR_RO_VARIANTS for ศร cluster', () => {
    const syllable = {
      initialConsonant: 'ศ',
      clusterConsonant: 'ร',
      vowelPattern: 'sara_i',
      finalConsonant: null,
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: true },
    };
    const positions = romanizeSyllable(syllable);
    const initTexts = positions[0].map(v => v.text);
    assert.ok(initTexts.includes('s'), `Should include "s", got: ${initTexts.join(', ')}`);
    assert.ok(initTexts.includes('sr'), `Should include "sr", got: ${initTexts.join(', ')}`);
  });
});

describe('romanizeSyllable - passthrough', () => {
  it('passes through non-Thai characters as-is', () => {
    const syllable = {
      raw: 'a',
      passthrough: true,
    };
    const positions = romanizeSyllable(syllable);
    assert.strictEqual(positions.length, 1);
    assert.strictEqual(positions[0][0].text, 'a');
    assert.strictEqual(positions[0][0].weight, 1.0);
  });
});

describe('romanizeSyllable - ฤ standalone', () => {
  it('romanizes ฤ with rue variants', () => {
    const syllable = {
      initialConsonant: '',
      vowelPattern: 'rue',
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: false },
    };
    const positions = romanizeSyllable(syllable);
    const texts = positions[0].map(v => v.text);
    assert.ok(texts.includes('ri'), `Should include "ri", got: ${texts.join(', ')}`);
    assert.ok(texts.includes('rue'), `Should include "rue", got: ${texts.join(', ')}`);
  });
});

describe('romanizeSyllable - unknown consonant fallback', () => {
  it('falls back for unrecognized consonant', () => {
    const syllable = {
      initialConsonant: '?',
      clusterConsonant: null,
      vowelPattern: 'sara_a',
      finalConsonant: null,
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: false },
    };
    const positions = romanizeSyllable(syllable);
    // Should still produce positions (fallback with weight 0.5)
    assert.ok(positions.length >= 1);
    assert.strictEqual(positions[0][0].text, '?');
    assert.strictEqual(positions[0][0].weight, 0.5);
  });
});

describe('romanizeSyllable - empty positions fallback', () => {
  it('returns raw text when no positions are produced', () => {
    const syllable = {
      initialConsonant: '',
      clusterConsonant: null,
      vowelPattern: 'nonexistent_vowel',
      finalConsonant: null,
      flags: { hoNam: false, oNam: false, roHan: false, thorSo: false, sorRo: false },
      raw: 'X',
    };
    const positions = romanizeSyllable(syllable);
    assert.strictEqual(positions.length, 1);
    assert.strictEqual(positions[0][0].text, 'X');
    assert.strictEqual(positions[0][0].weight, 0.5);
  });
});
