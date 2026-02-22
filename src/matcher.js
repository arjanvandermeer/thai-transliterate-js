import { levenshtein } from './levenshtein.js';

/**
 * Find the best matching variant for an English target string.
 *
 * @param {Array<{text: string, weight: number}>} variants - transliteration variants
 * @param {string} target - the English string to match against
 * @param {object} [options]
 * @param {number} [options.maxDistance] - maximum acceptable Levenshtein distance
 * @returns {{ variant: string, distance: number, weight: number, score: number } | null}
 */
export function bestMatch(variants, target, options = {}) {
  const normalizedTarget = target.toLowerCase().trim();
  let best = null;

  for (const v of variants) {
    const normalizedVariant = v.text.toLowerCase().trim();
    const dist = levenshtein(normalizedVariant, normalizedTarget);

    if (options.maxDistance !== undefined && dist > options.maxDistance) continue;

    // Score: combines string similarity (0-1) with variant weight (0-1)
    const maxLen = Math.max(normalizedVariant.length, normalizedTarget.length);
    const similarity = maxLen === 0 ? 1 : 1 - dist / maxLen;
    const score = similarity * 0.7 + v.weight * 0.3;

    if (!best || score > best.score) {
      best = { variant: v.text, distance: dist, weight: v.weight, score };
    }
  }

  return best;
}
