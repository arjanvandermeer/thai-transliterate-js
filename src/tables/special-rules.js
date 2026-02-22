/**
 * Ho-nam: ห before a low-class consonant modifies tone but is itself silent.
 * These are the consonants that can follow ห in the ho-nam pattern.
 */
export const HO_NAM_FOLLOWERS = new Set([
  'ง', 'ญ', 'น', 'ม', 'ย', 'ร', 'ล', 'ว',
]);

/** Check if ห + following consonant is a ho-nam pattern */
export function isHoNam(leader, follower) {
  return leader === 'ห' && HO_NAM_FOLLOWERS.has(follower);
}

/** Check if อ + ย is an o-nam pattern */
export function isONam(leader, follower) {
  return leader === 'อ' && follower === 'ย';
}
