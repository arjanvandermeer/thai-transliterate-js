import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseSyllables } from '../src/syllable-parser.js';

describe('parseSyllables - basic syllables', () => {
  it('parses a simple consonant + following vowel', () => {
    const syls = parseSyllables('กา');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ก');
    assert.strictEqual(syls[0].vowelPattern, 'sara_a');
    assert.strictEqual(syls[0].finalConsonant, null);
  });

  it('parses consonant + above vowel', () => {
    const syls = parseSyllables('กิ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ก');
    assert.strictEqual(syls[0].vowelPattern, 'sara_i_short');
  });

  it('parses consonant + below vowel', () => {
    const syls = parseSyllables('กุ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_u_short');
  });

  it('parses consonant + vowel + final consonant', () => {
    const syls = parseSyllables('กัน');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ก');
    assert.strictEqual(syls[0].vowelPattern, 'mai_han_akat');
    assert.strictEqual(syls[0].finalConsonant, 'น');
  });

  it('parses sara am (ำ) with included final', () => {
    const syls = parseSyllables('นำ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_am');
  });
});

describe('parseSyllables - leading vowels', () => {
  it('parses เ + consonant (sara e)', () => {
    const syls = parseSyllables('เก');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].leadingVowel, 'เ');
    assert.strictEqual(syls[0].vowelPattern, 'sara_e');
  });

  it('parses แ + consonant (sara ae)', () => {
    const syls = parseSyllables('แก');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ae');
  });

  it('parses โ + consonant (sara o)', () => {
    const syls = parseSyllables('โก');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_o');
  });

  it('parses ไ (sara ai malai)', () => {
    const syls = parseSyllables('ไก');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ai_malai');
  });

  it('parses ใ (sara ai muan)', () => {
    const syls = parseSyllables('ใน');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ai_muan');
  });

  it('parses เ-า (sara ao)', () => {
    const syls = parseSyllables('เกา');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ao');
  });

  it('parses โ-ะ (sara o short)', () => {
    const syls = parseSyllables('โกะ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_o_short');
  });

  it('parses แ-ะ (sara ae short)', () => {
    const syls = parseSyllables('แกะ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ae_short');
  });

  it('parses เ-ะ (sara e short)', () => {
    const syls = parseSyllables('เกะ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_e_short');
  });

  it('parses เ-อ (sara oe) at end of input', () => {
    const syls = parseSyllables('เกอ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_oe');
  });

  it('parses เ-อะ (sara oe short)', () => {
    const syls = parseSyllables('เกอะ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_oe_short');
  });

  it('parses เ-อ (sara oe) followed by consonant', () => {
    const syls = parseSyllables('เกอน');
    assert.ok(syls.length >= 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_oe');
  });

  it('parses เ-ือ (sara uea)', () => {
    // เสือ (tiger): เ + ส + ื + อ = sara_uea
    const syls = parseSyllables('เสือ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_uea');
  });
});

describe('parseSyllables - ho-nam and o-nam', () => {
  it('detects ho-nam (หม)', () => {
    const syls = parseSyllables('หมา');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].flags.hoNam, true);
    assert.strictEqual(syls[0].initialConsonant, 'ม');
  });

  it('detects ho-nam (หน)', () => {
    const syls = parseSyllables('หนา');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].flags.hoNam, true);
    assert.strictEqual(syls[0].initialConsonant, 'น');
  });

  it('suppresses ho-nam when follower precedes a leading vowel', () => {
    // พหลโยธิน: ห+ล+โ → ho-nam suppressed because ล is followed by โ
    const syls = parseSyllables('หลโ');
    // The ห should NOT be treated as ho-nam here
    const hSyl = syls.find(s => s.initialConsonant === 'ห');
    assert.ok(hSyl, 'Should have a syllable with ห as initial');
    assert.strictEqual(hSyl.flags.hoNam, false);
  });

  it('detects o-nam (อย)', () => {
    const syls = parseSyllables('อยู่');
    assert.strictEqual(syls[0].flags.oNam, true);
    assert.strictEqual(syls[0].initialConsonant, 'ย');
  });
});

describe('parseSyllables - consonant clusters', () => {
  it('detects กร cluster', () => {
    const syls = parseSyllables('กรุง');
    assert.strictEqual(syls[0].initialConsonant, 'ก');
    assert.strictEqual(syls[0].clusterConsonant, 'ร');
  });

  it('detects ปล cluster', () => {
    const syls = parseSyllables('ปลา');
    assert.strictEqual(syls[0].initialConsonant, 'ป');
    assert.strictEqual(syls[0].clusterConsonant, 'ล');
  });

  it('detects ทร cluster with thorSo flag', () => {
    const syls = parseSyllables('ทราย');
    assert.strictEqual(syls[0].flags.thorSo, true);
    assert.strictEqual(syls[0].initialConsonant, 'ท');
    assert.strictEqual(syls[0].clusterConsonant, 'ร');
  });

  it('detects ศร cluster with sorRo flag', () => {
    const syls = parseSyllables('ศรี');
    assert.strictEqual(syls[0].flags.sorRo, true);
  });
});

describe('parseSyllables - compound above vowels (ua)', () => {
  it('parses ัว (sara ua long)', () => {
    const syls = parseSyllables('กัว');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ua');
  });

  it('parses ัวะ (sara ua short)', () => {
    const syls = parseSyllables('กัวะ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ua_short');
  });
});

describe('parseSyllables - above vowels (ue)', () => {
  it('parses consonant + ึ (sara ue short)', () => {
    const syls = parseSyllables('กึ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ue_short');
  });

  it('parses consonant + ื (sara ue long)', () => {
    const syls = parseSyllables('กืน');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ue');
  });
});

describe('parseSyllables - following vowels (short a)', () => {
  it('parses consonant + ะ (sara a short)', () => {
    const syls = parseSyllables('กะ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_a_short');
  });
});

describe('parseSyllables - shortener without vowel', () => {
  it('handles standalone ็ (mai taikhu) as no-vowel marker', () => {
    // ก็ — shortener without an explicit vowel before it
    const syls = parseSyllables('ก็');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ก');
  });
});

describe('parseSyllables - implied vowels', () => {
  it('sets implied_o when final consonant present with no explicit vowel', () => {
    // กน = implied short 'o' + final น
    const syls = parseSyllables('กน');
    assert.strictEqual(syls[0].isImpliedVowel, true);
    assert.strictEqual(syls[0].vowelPattern, 'implied_o');
    assert.strictEqual(syls[0].finalConsonant, 'น');
  });
});

describe('parseSyllables - silent marks', () => {
  it('marks consonant before ์ as silent', () => {
    // ร์ = ร is silent
    const syls = parseSyllables('กร์');
    assert.ok(syls[0].silentChars.includes('ร'));
  });
});

describe('parseSyllables - tone marks', () => {
  it('captures tone mark', () => {
    const syls = parseSyllables('ก่า');
    assert.strictEqual(syls[0].toneMark, '่');
  });
});

describe('parseSyllables - multi-syllable words', () => {
  it('parses ภูเก็ต into 2 syllables', () => {
    const syls = parseSyllables('ภูเก็ต');
    assert.strictEqual(syls.length, 2);
    assert.strictEqual(syls[0].initialConsonant, 'ภ');
    assert.strictEqual(syls[1].initialConsonant, 'ก');
  });

  it('parses กรุงเทพ into 2 syllables', () => {
    const syls = parseSyllables('กรุงเทพ');
    assert.strictEqual(syls.length, 2);
    assert.strictEqual(syls[0].clusterConsonant, 'ร');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
  });
});

describe('parseSyllables - special characters', () => {
  it('handles ฤ as standalone syllable', () => {
    const syls = parseSyllables('ฤ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'rue');
  });

  it('passes through non-Thai characters', () => {
    const syls = parseSyllables('a');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].passthrough, true);
    assert.strictEqual(syls[0].raw, 'a');
  });

  it('passes through Thai digits', () => {
    const syls = parseSyllables('๑');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].passthrough, true);
  });
});

describe('parseSyllables - resolveFinal edge cases', () => {
  it('silences consonant before ์ when preceded by final (กานต์)', () => {
    // กานต์: ก=initial, า=vowel, น=final, ต์=silent
    const syls = parseSyllables('กานต์');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ก');
    assert.strictEqual(syls[0].finalConsonant, 'น');
    assert.ok(syls[0].silentChars.includes('ต'),
      `Should silence ต, got: ${syls[0].silentChars.join(', ')}`);
  });

  it('resolves final when next consonant is followed by tone mark (กนก่า)', () => {
    // กนก่า: ก=initial, implied_o, น=final, then ก่า is next syllable
    const syls = parseSyllables('กนก่า');
    assert.ok(syls.length >= 2, `Expected at least 2 syllables, got ${syls.length}`);
    const first = syls[0];
    assert.strictEqual(first.initialConsonant, 'ก');
    assert.strictEqual(first.finalConsonant, 'น');
  });

  it('handles dangling tone mark at end of input (กน่)', () => {
    // กน่: ก=initial, implied, น=candidate final + ่ at end
    const syls = parseSyllables('กน่');
    assert.ok(syls.length >= 1);
    // The tone-at-end path treats the consonant as final
    const hasFinalN = syls.some(s => s.finalConsonant === 'น');
    assert.ok(hasFinalN, `Should have น as final, got: ${JSON.stringify(syls)}`);
  });

  it('treats candidate final as next initial when followed by tone + more content (กน่า)', () => {
    // กน่า: ก=initial, implied_o/a, then น่า is a new syllable
    const syls = parseSyllables('กน่า');
    assert.ok(syls.length >= 2, `Expected at least 2 syllables, got ${syls.length}`);
    // Second syllable should have น as initial with tone mark
    const secondWithN = syls.find(s => s.initialConsonant === 'น');
    assert.ok(secondWithN, 'Should have น as initial of a syllable');
  });

  it('falls through to default final when followed by nikhahit (กนํ)', () => {
    // กนํ: ก=initial, น=candidate final followed by ํ (NIKHA)
    // The default path treats the consonant as final
    const syls = parseSyllables('กนํ');
    assert.ok(syls.length >= 1);
    const hasFinalN = syls.some(s => s.finalConsonant === 'น');
    assert.ok(hasFinalN, `Should have น as final, got: ${JSON.stringify(syls)}`);
  });

  it('handles valid cluster followed by non-vowel character (กากร๑)', () => {
    // กา=syllable, then กร is a valid cluster followed by ๑ (DIGIT)
    // This triggers the default final path in the CONS branch
    const syls = parseSyllables('กากร๑');
    assert.ok(syls.length >= 1);
    assert.ok(Array.isArray(syls));
  });
});

describe('parseSyllables - edge cases', () => {
  it('returns empty for empty string', () => {
    const syls = parseSyllables('');
    assert.deepStrictEqual(syls, []);
  });

  it('handles ro-han pattern (รร)', () => {
    // สรร = ส + รร vowel
    const syls = parseSyllables('สรร');
    assert.ok(syls.some(s => s.flags.roHan === true),
      'Should detect ro-han pattern');
  });

  it('never produces an infinite loop (safety check)', () => {
    // Even with unusual input, parseSyllables should always terminate
    const syls = parseSyllables('เเเเเ');
    assert.ok(Array.isArray(syls));
  });
});
