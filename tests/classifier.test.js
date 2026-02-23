import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyChar, isThaiChar, containsThai, isAllThai, isMostlyThai, getConsonantClass, canBeFinal } from '../src/classifier.js';

describe('classifyChar', () => {
  it('classifies consonants', () => {
    assert.equal(classifyChar('ก'), 'CONS');
    assert.equal(classifyChar('ข'), 'CONS');
    assert.equal(classifyChar('ฮ'), 'CONS');
    assert.equal(classifyChar('อ'), 'CONS');
  });

  it('classifies leading vowels', () => {
    assert.equal(classifyChar('เ'), 'V_LEAD');
    assert.equal(classifyChar('แ'), 'V_LEAD');
    assert.equal(classifyChar('โ'), 'V_LEAD');
    assert.equal(classifyChar('ไ'), 'V_LEAD');
    assert.equal(classifyChar('ใ'), 'V_LEAD');
  });

  it('classifies above vowels', () => {
    assert.equal(classifyChar('ั'), 'V_ABOVE');
    assert.equal(classifyChar('ิ'), 'V_ABOVE');
    assert.equal(classifyChar('ี'), 'V_ABOVE');
    assert.equal(classifyChar('ึ'), 'V_ABOVE');
    assert.equal(classifyChar('ื'), 'V_ABOVE');
  });

  it('classifies below vowels', () => {
    assert.equal(classifyChar('ุ'), 'V_BELOW');
    assert.equal(classifyChar('ู'), 'V_BELOW');
  });

  it('classifies following vowels', () => {
    assert.equal(classifyChar('ะ'), 'V_FOLLOW');
    assert.equal(classifyChar('า'), 'V_FOLLOW');
    assert.equal(classifyChar('ำ'), 'V_FOLLOW');
  });

  it('classifies tone marks', () => {
    assert.equal(classifyChar('่'), 'TONE');
    assert.equal(classifyChar('้'), 'TONE');
    assert.equal(classifyChar('๊'), 'TONE');
    assert.equal(classifyChar('๋'), 'TONE');
  });

  it('classifies special markers', () => {
    assert.equal(classifyChar('์'), 'SILENT');
    assert.equal(classifyChar('็'), 'SHORTENER');
    assert.equal(classifyChar('ํ'), 'NIKHA');
  });

  it('classifies special chars', () => {
    assert.equal(classifyChar('ฤ'), 'SPECIAL');
    assert.equal(classifyChar('ฦ'), 'SPECIAL');
  });

  it('classifies Thai digits', () => {
    assert.equal(classifyChar('๐'), 'DIGIT');
    assert.equal(classifyChar('๙'), 'DIGIT');
  });

  it('classifies non-Thai as OTHER', () => {
    assert.equal(classifyChar('a'), 'OTHER');
    assert.equal(classifyChar('1'), 'OTHER');
    assert.equal(classifyChar(' '), 'OTHER');
  });
});

describe('isThaiChar', () => {
  it('returns true for Thai characters', () => {
    assert.equal(isThaiChar('ก'), true);
    assert.equal(isThaiChar('เ'), true);
    assert.equal(isThaiChar('่'), true);
  });

  it('returns false for non-Thai characters', () => {
    assert.equal(isThaiChar('a'), false);
    assert.equal(isThaiChar('1'), false);
  });
});

describe('containsThai', () => {
  it('detects Thai in mixed text', () => {
    assert.equal(containsThai('hello กรุงเทพ world'), true);
  });

  it('returns false for pure English', () => {
    assert.equal(containsThai('hello world'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(containsThai(''), false);
  });
});

describe('isAllThai', () => {
  it('returns true for pure Thai text', () => {
    assert.equal(isAllThai('กรุงเทพ'), true);
  });

  it('returns true for Thai with spaces', () => {
    assert.equal(isAllThai('กรุงเทพ มหานคร'), true);
  });

  it('returns false for mixed Thai and Latin', () => {
    assert.equal(isAllThai('กรุงเทพ Bangkok'), false);
  });

  it('returns false for pure Latin', () => {
    assert.equal(isAllThai('Bangkok'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isAllThai(''), false);
  });

  it('returns false for whitespace only', () => {
    assert.equal(isAllThai('   '), false);
  });
});

describe('isMostlyThai', () => {
  it('returns true for pure Thai', () => {
    assert.equal(isMostlyThai('กรุงเทพ'), true);
  });

  it('returns true for mostly Thai with some Latin', () => {
    assert.equal(isMostlyThai('กรุงเทพมหานคร BKK'), true);
  });

  it('returns false for mostly Latin with some Thai', () => {
    assert.equal(isMostlyThai('Bangkok กทม'), false);
  });

  it('returns false for pure Latin', () => {
    assert.equal(isMostlyThai('Bangkok'), false);
  });

  it('returns false for empty string', () => {
    assert.equal(isMostlyThai(''), false);
  });

  it('ignores numbers and punctuation', () => {
    assert.equal(isMostlyThai('กรุงเทพ 123!'), true);
  });
});

describe('getConsonantClass', () => {
  it('returns mid for mid-class consonants', () => {
    assert.equal(getConsonantClass('ก'), 'mid');
    assert.equal(getConsonantClass('จ'), 'mid');
    assert.equal(getConsonantClass('ป'), 'mid');
  });

  it('returns high for high-class consonants', () => {
    assert.equal(getConsonantClass('ข'), 'high');
    assert.equal(getConsonantClass('ส'), 'high');
    assert.equal(getConsonantClass('ห'), 'high');
  });

  it('returns low for low-class consonants', () => {
    assert.equal(getConsonantClass('ค'), 'low');
    assert.equal(getConsonantClass('ง'), 'low');
    assert.equal(getConsonantClass('ร'), 'low');
  });

  it('returns undefined for non-consonants', () => {
    assert.equal(getConsonantClass('า'), undefined);
  });
});

describe('canBeFinal', () => {
  it('returns true for consonants that can be final', () => {
    assert.equal(canBeFinal('ก'), true);
    assert.equal(canBeFinal('น'), true);
    assert.equal(canBeFinal('ม'), true);
    assert.equal(canBeFinal('ท'), true);
    assert.equal(canBeFinal('ล'), true);
  });

  it('returns false for consonants that cannot be final', () => {
    assert.equal(canBeFinal('ห'), false);
    assert.equal(canBeFinal('ฉ'), false);
    assert.equal(canBeFinal('ผ'), false);
    assert.equal(canBeFinal('ฝ'), false);
    assert.equal(canBeFinal('ฮ'), false);
    assert.equal(canBeFinal('อ'), false);
  });
});
