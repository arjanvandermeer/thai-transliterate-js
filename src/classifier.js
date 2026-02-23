/**
 * Thai character classification.
 *
 * Character classes:
 *   CONS     - Consonant (ก-ฮ)
 *   V_LEAD   - Leading vowel (เ แ โ ไ ใ)
 *   V_ABOVE  - Above vowel (ั ิ ี ึ ื)
 *   V_BELOW  - Below vowel (ุ ู)
 *   V_FOLLOW - Following vowel (ะ า ำ)
 *   TONE     - Tone mark (่ ้ ๊ ๋)
 *   SILENT   - Thanthakhat (์)
 *   SHORTENER - Mai taikhu (็)
 *   NIKHA    - Nikhahit (ํ)
 *   SPECIAL  - ฤ ฦ
 *   DIGIT    - Thai digits (๐-๙)
 *   OTHER    - Everything else
 */

/** Classify a Thai character by its role in the script */
export function classifyChar(char) {
  const cp = char.codePointAt(0);

  // Special vowel-consonants: ฤ ฦ (U+0E24, U+0E26) — check before CONS range
  if (cp === 0x0E24 || cp === 0x0E26) return 'SPECIAL';

  // Consonants: ก-ฮ (U+0E01 - U+0E2E)
  if (cp >= 0x0E01 && cp <= 0x0E2E) return 'CONS';

  // Leading vowels: เ แ โ ไ ใ (U+0E40 - U+0E44)
  if (cp >= 0x0E40 && cp <= 0x0E44) return 'V_LEAD';

  // Above vowels: ั (U+0E31), ิ ี ึ ื (U+0E34-U+0E37)
  if (cp === 0x0E31 || (cp >= 0x0E34 && cp <= 0x0E37)) return 'V_ABOVE';

  // Below vowels: ุ ู (U+0E38-U+0E39)
  if (cp === 0x0E38 || cp === 0x0E39) return 'V_BELOW';

  // Following vowels: ะ า ำ (U+0E30, U+0E32, U+0E33)
  if (cp === 0x0E30 || cp === 0x0E32 || cp === 0x0E33) return 'V_FOLLOW';

  // Tone marks: ่ ้ ๊ ๋ (U+0E48-U+0E4B)
  if (cp >= 0x0E48 && cp <= 0x0E4B) return 'TONE';

  // Thanthakhat (silent mark): ์ (U+0E4C)
  if (cp === 0x0E4C) return 'SILENT';

  // Mai taikhu (shortener): ็ (U+0E47)
  if (cp === 0x0E47) return 'SHORTENER';

  // Nikhahit: ํ (U+0E4D)
  if (cp === 0x0E4D) return 'NIKHA';

  // Thai digits: ๐-๙ (U+0E50-U+0E59)
  if (cp >= 0x0E50 && cp <= 0x0E59) return 'DIGIT';

  return 'OTHER';
}

const WHITESPACE_RE = /\s/;
const LATIN_RE = /[A-Za-z]/;

/** Check if character is in the Thai Unicode block */
export function isThaiChar(char) {
  const cp = char.codePointAt(0);
  return cp >= 0x0E01 && cp <= 0x0E5B;
}

/** Check if a string contains any Thai characters */
export function containsThai(text) {
  for (const char of text) {
    if (isThaiChar(char)) return true;
  }
  return false;
}

/** Check if all non-whitespace/punctuation characters are Thai */
export function isAllThai(text) {
  if (!text) return false;
  let hasThai = false;
  for (const char of text) {
    if (WHITESPACE_RE.test(char)) continue;
    if (isThaiChar(char)) { hasThai = true; continue; }
    return false;
  }
  return hasThai;
}

/** Check if the majority of alphabetic characters are Thai (>50%) */
export function isMostlyThai(text) {
  if (!text) return false;
  let thai = 0;
  let other = 0;
  for (const char of text) {
    if (isThaiChar(char)) thai++;
    else if (LATIN_RE.test(char)) other++;
  }
  return thai > 0 && thai > other;
}

/** Consonant class lookup (mid/high/low) */
const CONSONANT_CLASSES = {
  // Mid class
  'ก': 'mid', 'จ': 'mid', 'ฎ': 'mid', 'ฏ': 'mid', 'ด': 'mid',
  'ต': 'mid', 'บ': 'mid', 'ป': 'mid', 'อ': 'mid',
  // High class
  'ข': 'high', 'ฃ': 'high', 'ฉ': 'high', 'ฐ': 'high', 'ถ': 'high',
  'ผ': 'high', 'ฝ': 'high', 'ศ': 'high', 'ษ': 'high', 'ส': 'high', 'ห': 'high',
  // Low class
  'ค': 'low', 'ฅ': 'low', 'ฆ': 'low', 'ง': 'low', 'ช': 'low',
  'ซ': 'low', 'ฌ': 'low', 'ญ': 'low', 'ฑ': 'low', 'ฒ': 'low',
  'ณ': 'low', 'ท': 'low', 'ธ': 'low', 'น': 'low', 'พ': 'low',
  'ฟ': 'low', 'ภ': 'low', 'ม': 'low', 'ย': 'low', 'ร': 'low',
  'ล': 'low', 'ว': 'low', 'ฬ': 'low', 'ฮ': 'low',
};

/** Get the consonant class (mid/high/low) for a Thai consonant */
export function getConsonantClass(char) {
  return CONSONANT_CLASSES[char];
}

/** Consonants that can NEVER appear in the final position of a syllable */
const CANNOT_BE_FINAL = new Set(['ห', 'ฉ', 'ผ', 'ฝ', 'ฮ', 'อ']);

/** Check if a Thai consonant can appear in the final position of a syllable */
export function canBeFinal(char) {
  return !CANNOT_BE_FINAL.has(char);
}
