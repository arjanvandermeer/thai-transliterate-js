/**
 * Pure algorithmic transliteration utilities (no dictionary).
 * Shared across calibration scripts.
 */

import { parseSyllables } from '../../src/syllable-parser.js';
import { romanizeSyllable } from '../../src/romanizer.js';
import { generateVariants } from '../../src/variant-generator.js';

// Thai word segmenter (created once, reused)
let segmenter = null;
try {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  }
} catch { /* unavailable */ }

/**
 * Segment Thai text into words.
 * @param {string} thai
 * @returns {string[]}
 */
export function segmentWords(thai) {
  if (segmenter) {
    return [...segmenter.segment(thai)]
      .filter(seg => seg.isWordLike)
      .map(seg => seg.segment);
  }
  const parts = thai.split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts : [thai];
}

/**
 * Pure algorithmic transliteration for a single Thai word (no dictionary).
 * Returns variant objects with text and weight.
 *
 * @param {string} word - single Thai word
 * @param {number} [maxVariants=15]
 * @returns {Array<{text: string, weight: number}>}
 */
export function algorithmicVariantsWord(word, maxVariants = 15) {
  const syllables = parseSyllables(word);
  const positions = syllables.map(syl => romanizeSyllable(syl));
  return generateVariants(positions, { maxVariants });
}

/**
 * Pure algorithmic transliteration for Thai text (may be multi-word).
 * Returns lowercase variant texts for distance comparison.
 *
 * @param {string} thai - Thai text (may contain multiple words)
 * @returns {string[]} lowercase variant texts
 */
export function algorithmicVariantsText(thai) {
  const words = segmentWords(thai);
  const perWord = words.map(word => algorithmicVariantsWord(word));

  if (perWord.length === 1) {
    return perWord[0].map(v => v.text.toLowerCase());
  }

  // Combine across words (concatenate top variants with/without space)
  let combined = perWord[0].map(v => v.text.toLowerCase());
  for (let i = 1; i < perWord.length; i++) {
    const next = [];
    for (const acc of combined) {
      for (const v of perWord[i]) {
        next.push(acc + v.text.toLowerCase());
        next.push(acc + ' ' + v.text.toLowerCase());
      }
    }
    combined = next.slice(0, 50); // cap to prevent explosion
  }
  return combined;
}
