/**
 * Generate all romanization variants from per-syllable positional variant arrays.
 *
 * Takes an array of syllable results, where each syllable is an array of
 * positional WeightedVariant arrays (from romanizeSyllable).
 *
 * Returns a flat array of { text, weight } sorted by weight descending.
 */

/** Max variants to carry forward per syllable to prevent combinatorial explosion */
const MAX_PER_SYLLABLE = 8;
const MAX_INTERMEDIATE = 50;

export function generateVariants(syllablePositions, options = {}) {
  const maxVariants = options.maxVariants ?? 20;
  const minWeight = options.minWeight ?? 0.01;

  // Step 1: Intra-syllable cartesian product (positions within each syllable)
  // Cap each syllable to top MAX_PER_SYLLABLE variants
  const syllableVariants = syllablePositions.map(positions => {
    const variants = cartesianProduct(positions, minWeight);
    variants.sort((a, b) => b.weight - a.weight);
    return variants.slice(0, MAX_PER_SYLLABLE);
  });

  // Step 2: Inter-syllable cartesian product with aggressive pruning
  let wordVariants = cartesianProductWords(syllableVariants, minWeight);

  // Step 3: Dedup (keep highest weight for identical strings)
  wordVariants = dedup(wordVariants);

  // Step 4: Add compact variants (spaces removed)
  if (options.includeCompact !== false) {
    const compacts = [];
    for (const v of wordVariants) {
      if (v.text.includes(' ')) {
        const compact = v.text.replace(/\s+/g, '');
        compacts.push({ text: compact, weight: v.weight * 0.9 });
      }
    }
    if (compacts.length > 0) {
      wordVariants.push(...compacts);
      wordVariants = dedup(wordVariants);
    }
  }

  // Step 5: Sort by weight descending, truncate
  wordVariants.sort((a, b) => b.weight - a.weight);
  return wordVariants.slice(0, maxVariants);
}

/**
 * Cartesian product of multiple WeightedVariant arrays.
 * Prunes branches below minWeight.
 */
function cartesianProduct(arrays, minWeight) {
  if (arrays.length === 0) return [{ text: '', weight: 1.0 }];

  let results = [{ text: '', weight: 1.0 }];

  for (const variants of arrays) {
    const next = [];
    for (const acc of results) {
      for (const v of variants) {
        const weight = acc.weight * v.weight;
        if (weight >= minWeight) {
          next.push({ text: acc.text + v.text, weight });
        }
      }
    }
    results = next;
    if (results.length === 0) break;
  }

  return results;
}

/**
 * Combine variants across multiple syllables (with no separator).
 * Prunes aggressively after each syllable to prevent explosion.
 */
function cartesianProductWords(syllableVariants, minWeight) {
  if (syllableVariants.length === 0) return [];
  if (syllableVariants.length === 1) return [...syllableVariants[0]];

  let results = syllableVariants[0].map(v => ({ ...v }));

  for (let s = 1; s < syllableVariants.length; s++) {
    const next = [];
    for (const acc of results) {
      for (const v of syllableVariants[s]) {
        const weight = acc.weight * v.weight;
        if (weight >= minWeight) {
          next.push({ text: acc.text + v.text, weight });
        }
      }
    }
    // Prune after each syllable: keep top MAX_INTERMEDIATE
    next.sort((a, b) => b.weight - a.weight);
    results = next.slice(0, MAX_INTERMEDIATE);
    if (results.length === 0) break;
  }

  return results;
}

/** Deduplicate variants, keeping the highest weight for each unique text */
function dedup(variants) {
  const map = new Map();
  for (const v of variants) {
    const key = v.text.toLowerCase();
    const existing = map.get(key);
    if (!existing || v.weight > existing.weight) {
      map.set(key, { text: v.text, weight: v.weight });
    }
  }
  return [...map.values()];
}
