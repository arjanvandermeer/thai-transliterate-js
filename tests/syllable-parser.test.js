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

describe('parseSyllables - cluster + consonant (implied vowel)', () => {
  it('parses ทรง as 1 syllable with ทร cluster + implied_o + ง final', () => {
    const syls = parseSyllables('ทรง');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].flags.thorSo, true);
    assert.strictEqual(syls[0].clusterConsonant, 'ร');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
    assert.strictEqual(syls[0].vowelPattern, 'implied_o');
  });

  it('parses กรม as 1 syllable with กร cluster + implied_o + ม final', () => {
    const syls = parseSyllables('กรม');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ก');
    assert.strictEqual(syls[0].clusterConsonant, 'ร');
    assert.strictEqual(syls[0].finalConsonant, 'ม');
    assert.strictEqual(syls[0].vowelPattern, 'implied_o');
  });

  it('parses ตรง as 1 syllable with ตร cluster + implied_o + ง final', () => {
    const syls = parseSyllables('ตรง');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].clusterConsonant, 'ร');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
  });

  it('still parses ทราย correctly (cluster + vowel, no change)', () => {
    const syls = parseSyllables('ทราย');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].flags.thorSo, true);
    assert.strictEqual(syls[0].vowelPattern, 'sara_a');
  });
});

describe('parseSyllables - isFirstSyllable flag', () => {
  it('marks first syllable of single-syllable word', () => {
    const syls = parseSyllables('ทราย');
    assert.strictEqual(syls[0].isFirstSyllable, true);
  });

  it('marks first syllable true and rest false in multi-syllable word', () => {
    const syls = parseSyllables('รามอินทรา');
    assert.strictEqual(syls[0].isFirstSyllable, true);
    for (let i = 1; i < syls.length; i++) {
      assert.strictEqual(syls[i].isFirstSyllable, false,
        `Syllable ${i} ("${syls[i].raw}") should have isFirstSyllable=false`);
    }
  });

  it('single consonant syllable gets isFirstSyllable=true', () => {
    const syls = parseSyllables('กา');
    assert.strictEqual(syls[0].isFirstSyllable, true);
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

describe('parseSyllables - sara aw (อ as vowel)', () => {
  it('parses ซอย as one syllable with sara_aw + final ย', () => {
    const syls = parseSyllables('ซอย');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ซ');
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
    assert.strictEqual(syls[0].finalConsonant, 'ย');
  });

  it('parses ทอง as one syllable with sara_aw + final ง', () => {
    const syls = parseSyllables('ทอง');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ท');
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
  });

  it('parses หอ as one syllable with sara_aw (open, no final)', () => {
    const syls = parseSyllables('หอ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ห');
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
    assert.strictEqual(syls[0].finalConsonant, null);
  });

  it('preserves o-nam for อย at word start (อยู่)', () => {
    const syls = parseSyllables('อยู่');
    assert.strictEqual(syls[0].flags.oNam, true);
    assert.strictEqual(syls[0].initialConsonant, 'ย');
    assert.strictEqual(syls[0].vowelPattern, 'sara_u');
  });

  it('does not trigger sara_aw when อ is followed by a vowel marker (สะอาด)', () => {
    const syls = parseSyllables('สะอาด');
    // First syllable: ส+ะ
    assert.strictEqual(syls[0].initialConsonant, 'ส');
    assert.strictEqual(syls[0].vowelPattern, 'sara_a_short');
    // Second syllable: อ+า+ด (อ is consonant initial, not sara_aw)
    assert.strictEqual(syls[1].initialConsonant, 'อ');
    assert.strictEqual(syls[1].vowelPattern, 'sara_a');
  });

  it('parses ดอน as one syllable with sara_aw + final น', () => {
    const syls = parseSyllables('ดอน');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ด');
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
    assert.strictEqual(syls[0].finalConsonant, 'น');
  });

  it('parses ออก as อ initial + sara_aw + final ก', () => {
    const syls = parseSyllables('ออก');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'อ');
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
    assert.strictEqual(syls[0].finalConsonant, 'ก');
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

describe('parseSyllables - tone mark handling', () => {
  it('parses C + tone + follow-vowel า as single syllable (บ้าน)', () => {
    const syls = parseSyllables('บ้าน');
    assert.strictEqual(syls.length, 1, 'Should be 1 syllable, not 2');
    assert.strictEqual(syls[0].initialConsonant, 'บ');
    assert.strictEqual(syls[0].vowelPattern, 'sara_a');
    assert.strictEqual(syls[0].finalConsonant, 'น');
    assert.strictEqual(syls[0].toneMark, '้');
  });

  it('parses C + tone + sara_aw อ as single syllable (บ่อ)', () => {
    const syls = parseSyllables('บ่อ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
    assert.strictEqual(syls[0].toneMark, '่');
  });

  it('parses ห + tone + อ as sara_aw single syllable (ห้อง)', () => {
    const syls = parseSyllables('ห้อง');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ห');
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
    assert.strictEqual(syls[0].toneMark, '้');
  });

  it('parses leading เ + C + tone + า as sara_ao (เจ้า)', () => {
    const syls = parseSyllables('เจ้า');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ao');
    assert.strictEqual(syls[0].toneMark, '้');
  });

  it('parses ั + tone + ว as sara_ua (บั้ว)', () => {
    const syls = parseSyllables('บั้ว');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ua');
  });

  it('parses เ + ี + tone + ย as sara_ia (เบี้ย)', () => {
    const syls = parseSyllables('เบี้ย');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ia');
  });

  it('parses เ + ี + tone + ย + final as sara_ia (เลี้ยง)', () => {
    const syls = parseSyllables('เลี้ยง');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ia');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
  });

  it('parses เ + ื + tone + อ as sara_uea (เมื้อ)', () => {
    const syls = parseSyllables('เมื้อ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_uea');
  });

  it('still handles above vowel + tone correctly (บิ่น)', () => {
    const syls = parseSyllables('บิ่น');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_i_short');
    assert.strictEqual(syls[0].finalConsonant, 'น');
    assert.strictEqual(syls[0].toneMark, '่');
  });

  it('still handles leading vowel แ + tone correctly (แม่)', () => {
    const syls = parseSyllables('แม่');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ae');
    assert.strictEqual(syls[0].toneMark, '่');
  });

  it('parses C + tone + ำ as sara_am (น้ำ)', () => {
    const syls = parseSyllables('น้ำ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_am');
    assert.strictEqual(syls[0].toneMark, '้');
  });

  it('parses C + tone + ะ as sara_a_short (จ๊ะ)', () => {
    const syls = parseSyllables('จ๊ะ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_a_short');
    assert.strictEqual(syls[0].toneMark, '๊');
  });
});

describe('parseSyllables - ว as implied vowel', () => {
  it('parses ว as sara_ua in ห้วย (huai)', () => {
    const syls = parseSyllables('ห้วย');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ua');
    assert.strictEqual(syls[0].finalConsonant, 'ย');
  });

  it('parses ว as sara_ua in หลวง (luang)', () => {
    const syls = parseSyllables('หลวง');
    assert.strictEqual(syls.length, 1);
    assert.ok(syls[0].flags.hoNam);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ua');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
  });

  it('parses ว as sara_ua in ม่วง (muang)', () => {
    const syls = parseSyllables('ม่วง');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_ua');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
    assert.strictEqual(syls[0].toneMark, '่');
  });
});

describe('parseSyllables - cluster + อ as sara_aw', () => {
  it('parses คลอง as cluster คล + sara_aw + final ง', () => {
    const syls = parseSyllables('คลอง');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'ค');
    assert.strictEqual(syls[0].clusterConsonant, 'ล');
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
    assert.strictEqual(syls[0].finalConsonant, 'ง');
  });

  it('parses คลอ as cluster คล + sara_aw', () => {
    const syls = parseSyllables('คลอ');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].clusterConsonant, 'ล');
    assert.strictEqual(syls[0].vowelPattern, 'sara_aw');
  });
});

describe('parseSyllables - thanthakhat (์) cancellation', () => {
  it('parses โพธิ์ as single syllable with silent ธ', () => {
    const syls = parseSyllables('โพธิ์');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].initialConsonant, 'พ');
    assert.strictEqual(syls[0].vowelPattern, 'sara_o');
    assert.ok(syls[0].silentChars.includes('ธ'));
    assert.strictEqual(syls[0].finalConsonant, null);
  });

  it('parses สุรินทร์ with silent ทร์ syllable', () => {
    const syls = parseSyllables('สุรินทร์');
    // Last syllable has implied vowel + silentChars
    const last = syls[syls.length - 1];
    assert.ok(last.silentChars.includes('ร'));
    assert.ok(last.isImpliedVowel);
  });

  it('parses จันทร์ with silent ทร์ syllable', () => {
    const syls = parseSyllables('จันทร์');
    assert.strictEqual(syls[0].initialConsonant, 'จ');
    assert.strictEqual(syls[0].vowelPattern, 'mai_han_akat');
    assert.strictEqual(syls[0].finalConsonant, 'น');
  });

  it('parses โพธิ์ชัย as two syllables (silent ธ + ชัย)', () => {
    const syls = parseSyllables('โพธิ์ชัย');
    assert.strictEqual(syls.length, 2);
    assert.strictEqual(syls[0].vowelPattern, 'sara_o');
    assert.ok(syls[0].silentChars.includes('ธ'));
    assert.strictEqual(syls[1].initialConsonant, 'ช');
  });
});

describe('parseSyllables - sara_oe_short (เ-ิ)', () => {
  it('parses เกิด as sara_oe_short', () => {
    const syls = parseSyllables('เกิด');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_oe_short');
    assert.strictEqual(syls[0].finalConsonant, 'ด');
  });

  it('parses เดิน as sara_oe_short', () => {
    const syls = parseSyllables('เดิน');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_oe_short');
    assert.strictEqual(syls[0].finalConsonant, 'น');
  });

  it('parses เงิน as sara_oe_short', () => {
    const syls = parseSyllables('เงิน');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_oe_short');
  });

  it('does not affect เกม (no ิ after initial)', () => {
    const syls = parseSyllables('เกม');
    assert.strictEqual(syls.length, 1);
    assert.strictEqual(syls[0].vowelPattern, 'sara_e');
    assert.strictEqual(syls[0].finalConsonant, 'ม');
  });
});

describe('parseSyllables - leading vowel reassignment', () => {
  it('reassigns เ in เจริญ: จ(implied) + เริญ(sara_oe_short)', () => {
    const syls = parseSyllables('เจริญ');
    assert.strictEqual(syls.length, 2);
    assert.strictEqual(syls[0].initialConsonant, 'จ');
    assert.strictEqual(syls[0].vowelPattern, 'implied_a');
    assert.strictEqual(syls[1].leadingVowel, 'เ');
    assert.strictEqual(syls[1].initialConsonant, 'ร');
    assert.strictEqual(syls[1].vowelPattern, 'sara_oe_short');
    assert.strictEqual(syls[1].finalConsonant, 'ญ');
  });

  it('reassigns เ in เฉลิม: ฉ(implied) + เลิม(sara_oe_short)', () => {
    const syls = parseSyllables('เฉลิม');
    assert.strictEqual(syls.length, 2);
    assert.strictEqual(syls[0].initialConsonant, 'ฉ');
    assert.strictEqual(syls[0].vowelPattern, 'implied_a');
    assert.strictEqual(syls[1].vowelPattern, 'sara_oe_short');
  });

  it('does not reassign in เชียงใหม่ (has compound sara_ia)', () => {
    const syls = parseSyllables('เชียงใหม่');
    assert.strictEqual(syls[0].vowelPattern, 'sara_ia');
  });

  it('does not reassign in เกม (has final consonant)', () => {
    const syls = parseSyllables('เกม');
    assert.strictEqual(syls[0].vowelPattern, 'sara_e');
  });
});
