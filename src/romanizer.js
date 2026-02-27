import { CONSONANTS, VOWEL_PATTERNS, THOR_SO_VARIANTS, THOR_SO_VARIANTS_MEDIAL, SOR_RO_VARIANTS } from './tables/load-weights.js';
import { CLUSTER_SECOND } from './tables/clusters.js';

/**
 * Romanize a single parsed syllable into an array of positional variant arrays.
 *
 * Returns an array where each element is a WeightedVariant[] for one position:
 * [initialVariants, clusterVariants?, vowelVariants, finalVariants?]
 *
 * The caller then does a cartesian product to get all syllable-level variants.
 */
export function romanizeSyllable(syllable) {
  // Passthrough (non-Thai characters)
  if (syllable.passthrough) {
    return [[{ text: syllable.raw, weight: 1.0 }]];
  }

  // Skip syllables that are entirely silent (e.g., ทร์ in สุรินทร์)
  // These have an implied vowel, silent trailing consonant(s), and no final —
  // the whole syllable is a vestigial Sanskrit/Pali suffix.
  if (syllable.isImpliedVowel && syllable.silentChars?.length > 0 && !syllable.finalConsonant) {
    return [];
  }

  // Special: ฤ/ฦ standalone
  if (!syllable.initialConsonant && syllable.vowelPattern === 'rue') {
    const vowelEntry = VOWEL_PATTERNS.rue;
    return [vowelEntry.variants];
  }

  const positions = [];

  // 1. Initial consonant
  if (syllable.flags.thorSo) {
    // ทร cluster: use full variants (including "s") only for word-initial position.
    // Mid-word ทร (อินทรา, จันทร์) is never pronounced "s".
    positions.push(syllable.isFirstSyllable ? THOR_SO_VARIANTS : THOR_SO_VARIANTS_MEDIAL);
  } else if (syllable.flags.sorRo) {
    // ศร → "s" special case: ร is typically silent (ศรี → si)
    positions.push(SOR_RO_VARIANTS);
  } else {
    // Normal initial
    const initEntry = CONSONANTS[syllable.initialConsonant];
    if (initEntry) {
      positions.push(initEntry.initial);
    } else if (syllable.initialConsonant) {
      positions.push([{ text: syllable.initialConsonant, weight: 0.5 }]);
    }

    // 2. Cluster consonant
    if (syllable.clusterConsonant) {
      const clusterVariants = CLUSTER_SECOND[syllable.clusterConsonant];
      if (clusterVariants) {
        positions.push(clusterVariants);
      }
    }
  }

  // 3. Vowel
  const vowelEntry = VOWEL_PATTERNS[syllable.vowelPattern];
  if (vowelEntry) {
    positions.push(vowelEntry.variants);
  }

  // 4. Final consonant (unless vowel already includes it, e.g. ำ→am, รร→an)
  if (syllable.finalConsonant && !(vowelEntry && vowelEntry.includesFinal)) {
    const finalEntry = CONSONANTS[syllable.finalConsonant];
    if (finalEntry && finalEntry.final.length > 0) {
      positions.push(finalEntry.final);
    }
  }

  // Edge case: if we have nothing, return the raw text
  if (positions.length === 0) {
    return [[{ text: syllable.raw, weight: 0.5 }]];
  }

  return positions;
}
