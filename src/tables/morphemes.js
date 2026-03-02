/**
 * Known multi-syllable morphemes where standard parsing produces incorrect results.
 *
 * Each morpheme maps Thai characters to pre-parsed syllable definitions.
 * The parser checks for these before standard syllable-by-syllable parsing,
 * emitting the pre-defined syllables when a match is found.
 *
 * Format: Map<string, Array<{initial, vowel, final?}>>
 */
export const MORPHEME_TABLE = new Map([
  // นคร (nakhon) — "city/capital" from Sanskrit "nagara"
  // Standard parsing gives: น+implied_o+final:ค (silent:ร) → "nok"
  // Correct: น(implied_a) + ค(sara_aw)+final:ร → "na-khon"
  ['นคร', [
    { initial: 'น', vowel: 'implied_a' },
    { initial: 'ค', vowel: 'sara_aw', final: 'ร' },
  ]],
]);
