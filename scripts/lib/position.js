/**
 * Infer position type from position index and syllable structure.
 *
 * @param {number} posIdx - index into the positions array
 * @param {Array} positions - romanized position arrays for the syllable
 * @param {object} syllable - parsed syllable object
 * @returns {'cluster_special'|'initial'|'cluster'|'vowel'|'final'}
 */
export function inferPositionType(posIdx, positions, syllable) {
  // Special cases: thorSo/sorRo replace initial+cluster with single position
  if (syllable.flags.thorSo || syllable.flags.sorRo) {
    if (posIdx === 0) return 'cluster_special';
    if (posIdx === 1) return 'vowel';
    return 'final';
  }

  // Normal syllable: initial, [cluster], vowel, [final]
  let idx = 0;
  if (posIdx === idx) return 'initial';
  idx++;

  if (syllable.clusterConsonant) {
    if (posIdx === idx) return 'cluster';
    idx++;
  }

  if (posIdx === idx) return 'vowel';
  return 'final';
}
