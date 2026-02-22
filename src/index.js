import { containsThai } from './classifier.js';
import { parseSyllables } from './syllable-parser.js';
import { romanizeSyllable } from './romanizer.js';
import { generateVariants } from './variant-generator.js';
import { bestMatch } from './matcher.js';

export { levenshtein } from './levenshtein.js';
export { bestMatch } from './matcher.js';

/**
 * Transliterate Thai text to Roman/Latin characters.
 * Returns per-word variant arrays, preserving word boundaries.
 *
 * @param {string} thai - Thai text to transliterate
 * @param {object} [options]
 * @param {number} [options.maxVariants=20] - maximum variants per word
 * @param {number} [options.minWeight=0.01] - minimum weight threshold
 * @param {boolean} [options.includeCompact=true] - include space-removed variants
 * @returns {Array<{thai: string, variants: Array<{text: string, weight: number}>}>}
 */
export function transliterateWords(thai, options = {}) {
  if (!thai || typeof thai !== 'string') return [];
  return processWords(thai, options);
}

/**
 * Transliterate Thai text to Roman/Latin characters.
 * Returns multiple weighted variants sorted by likelihood.
 * Convenience wrapper that flattens transliterateWords() into combined strings.
 *
 * @param {string} thai - Thai text to transliterate
 * @param {object} [options]
 * @param {number} [options.maxVariants=20] - maximum variants to return
 * @param {number} [options.minWeight=0.01] - minimum weight threshold
 * @param {boolean} [options.includeCompact=true] - include space-removed variants
 * @returns {Array<{text: string, weight: number}>}
 */
export function transliterate(thai, options = {}) {
  if (!thai || typeof thai !== 'string') return [];
  const wordResults = processWords(thai, options);
  const wordVariantArrays = wordResults.map(w => w.variants);
  return combineWordVariants(wordVariantArrays, options);
}

/** Process Thai text into per-word variant arrays */
function processWords(thai, options) {
  const words = segmentWords(thai);
  return words.map(word => {
    if (!containsThai(word)) {
      return { thai: word, variants: [{ text: word, weight: 1.0 }] };
    }
    const syllables = parseSyllables(word);
    const syllablePositions = syllables.map(syl => romanizeSyllable(syl));
    const variants = generateVariants(syllablePositions, options);
    return { thai: word, variants };
  });
}

/**
 * Transliterate Thai text and match against an English target string.
 * Convenience wrapper around transliterate() + bestMatch().
 *
 * @param {string} thai - Thai text
 * @param {string} target - English string to match against
 * @param {object} [options]
 * @returns {{ variant: string, distance: number, weight: number, score: number } | null}
 */
export function matchThai(thai, target, options = {}) {
  const variants = transliterate(thai, options);
  return bestMatch(variants, target, options);
}

/** Module-level Thai word segmenter (created once, reused) */
let thaiSegmenter = null;
try {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    thaiSegmenter = new Intl.Segmenter('th', { granularity: 'word' });
  }
} catch {
  // Intl.Segmenter not available in this environment
}

/** Segment Thai text into words */
function segmentWords(text) {
  if (thaiSegmenter) {
    return [...thaiSegmenter.segment(text)]
      .filter(seg => seg.isWordLike)
      .map(seg => seg.segment);
  }
  // Fallback: split on whitespace, or treat as single word
  const parts = text.split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts : [text];
}

/** Combine variant arrays across multiple words with space separator */
function combineWordVariants(wordVariantArrays, options) {
  if (wordVariantArrays.length === 0) return [];
  if (wordVariantArrays.length === 1) return wordVariantArrays[0];

  const maxVariants = options.maxVariants ?? 20;
  const minWeight = options.minWeight ?? 0.01;

  let combined = wordVariantArrays[0].map(v => ({ ...v }));

  for (let w = 1; w < wordVariantArrays.length; w++) {
    const next = [];
    for (const acc of combined) {
      for (const v of wordVariantArrays[w]) {
        const weight = acc.weight * v.weight;
        if (weight >= minWeight) {
          next.push({ text: acc.text + ' ' + v.text, weight });
        }
      }
    }
    combined = next;
    if (combined.length === 0) break;
  }

  // Dedup, sort, truncate
  const map = new Map();
  for (const v of combined) {
    const key = v.text.toLowerCase();
    const existing = map.get(key);
    if (!existing || v.weight > existing.weight) {
      map.set(key, v);
    }
  }

  const results = [...map.values()];
  results.sort((a, b) => b.weight - a.weight);
  return results.slice(0, maxVariants);
}
