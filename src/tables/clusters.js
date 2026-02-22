/** Valid Thai consonant clusters (initial + ร/ล/ว) */
export const VALID_CLUSTERS = new Set([
  'กร', 'กล', 'กว',
  'ขร', 'ขล', 'ขว',
  'คร', 'คล', 'คว',
  'ตร',
  'ปร', 'ปล',
  'ผล',
  'พร', 'พล',
  'ฝร',
  'ฟร',
  'สร', 'สล', 'สว',
  'ทร',
  'บร', 'บล',
  'ดร',
]);

/** Check if two consonants form a valid cluster */
export function isValidCluster(c1, c2) {
  return VALID_CLUSTERS.has(c1 + c2);
}

/**
 * Romanization variants for the second consonant in a cluster.
 * The first consonant uses its normal initial romanization.
 */
export const CLUSTER_SECOND = {
  'ร': [{ text: 'r', weight: 1.0 }, { text: 'l', weight: 0.2 }],
  'ล': [{ text: 'l', weight: 1.0 }],
  'ว': [{ text: 'w', weight: 1.0 }],
};

/**
 * Special ทร cluster:
 * - "thr" is the RTGS standard (อินทรา → inthra)
 * - "tr" is extremely common informal (อินทรา → intra, as in "Ramintra")
 * - "s" is a colloquial pronunciation for certain words (ทราย → sai, ทราบ → sap)
 * - "sr" is rare
 */
export const THOR_SO_VARIANTS = [
  { text: 'thr', weight: 0.7 },
  { text: 'tr', weight: 0.5 },
  { text: 's', weight: 0.4 },
  { text: 'sr', weight: 0.1 },
];
