/**
 * Complete mapping of all 44 Thai consonants (RTGS + well-established variants only).
 * Each entry provides weighted romanization variants for initial and final positions.
 * Weight 1.0 = RTGS standard. Lower weights = informal/Paiboon/phonetic alternatives.
 *
 * Data-derived variants are in weight-overrides.json newVariants section,
 * merged at runtime by load-weights.js.
 */
export const BASE_CONSONANTS = {
  // === MID CLASS ===
  'ก': {
    char: 'ก', class: 'mid',
    initial: [{ text: 'k', weight: 1.0 }, { text: 'g', weight: 0.6 }],
    final: [{ text: 'k', weight: 1.0 }, { text: 'g', weight: 0.3 }],
  },
  'จ': {
    char: 'จ', class: 'mid',
    initial: [{ text: 'ch', weight: 1.0 }, { text: 'j', weight: 0.7 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ฎ': {
    char: 'ฎ', class: 'mid',
    initial: [{ text: 'd', weight: 1.0 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ฏ': {
    char: 'ฏ', class: 'mid',
    initial: [{ text: 't', weight: 1.0 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ด': {
    char: 'ด', class: 'mid',
    initial: [{ text: 'd', weight: 1.0 }, { text: 'dt', weight: 0.3 }],
    final: [{ text: 't', weight: 1.0 }, { text: 'd', weight: 0.4 }],
  },
  'ต': {
    char: 'ต', class: 'mid',
    initial: [{ text: 't', weight: 1.0 }, { text: 'dt', weight: 0.3 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'บ': {
    char: 'บ', class: 'mid',
    initial: [{ text: 'b', weight: 1.0 }],
    final: [{ text: 'p', weight: 1.0 }, { text: 'b', weight: 0.4 }],
  },
  'ป': {
    char: 'ป', class: 'mid',
    initial: [{ text: 'p', weight: 1.0 }],
    final: [{ text: 'p', weight: 1.0 }],
  },
  'อ': {
    char: 'อ', class: 'mid',
    initial: [{ text: '', weight: 1.0 }],
    final: [],
  },

  // === HIGH CLASS ===
  'ข': {
    char: 'ข', class: 'high',
    initial: [{ text: 'kh', weight: 1.0 }, { text: 'k', weight: 0.5 }],
    final: [{ text: 'k', weight: 1.0 }],
  },
  'ฃ': {
    char: 'ฃ', class: 'high',
    initial: [{ text: 'kh', weight: 1.0 }, { text: 'k', weight: 0.5 }],
    final: [{ text: 'k', weight: 1.0 }],
  },
  'ฉ': {
    char: 'ฉ', class: 'high',
    initial: [{ text: 'ch', weight: 1.0 }],
    final: [],
  },
  'ฐ': {
    char: 'ฐ', class: 'high',
    initial: [{ text: 'th', weight: 1.0 }, { text: 't', weight: 0.4 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ถ': {
    char: 'ถ', class: 'high',
    initial: [{ text: 'th', weight: 1.0 }, { text: 't', weight: 0.4 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ผ': {
    char: 'ผ', class: 'high',
    initial: [{ text: 'ph', weight: 1.0 }, { text: 'p', weight: 0.5 }],
    final: [],
  },
  'ฝ': {
    char: 'ฝ', class: 'high',
    initial: [{ text: 'f', weight: 1.0 }],
    final: [],
  },
  'ศ': {
    char: 'ศ', class: 'high',
    initial: [{ text: 's', weight: 1.0 }, { text: 'sh', weight: 0.3 }],
    final: [{ text: 't', weight: 1.0 }, { text: 's', weight: 0.3 }],
  },
  'ษ': {
    char: 'ษ', class: 'high',
    initial: [{ text: 's', weight: 1.0 }],
    final: [{ text: 't', weight: 1.0 }, { text: 's', weight: 0.3 }],
  },
  'ส': {
    char: 'ส', class: 'high',
    initial: [{ text: 's', weight: 1.0 }],
    final: [{ text: 't', weight: 1.0 }, { text: 's', weight: 0.3 }],
  },
  'ห': {
    char: 'ห', class: 'high',
    initial: [{ text: 'h', weight: 1.0 }],
    final: [],
  },

  // === LOW CLASS ===
  'ค': {
    char: 'ค', class: 'low',
    initial: [{ text: 'kh', weight: 1.0 }, { text: 'k', weight: 0.5 }],
    final: [{ text: 'k', weight: 1.0 }],
  },
  'ฅ': {
    char: 'ฅ', class: 'low',
    initial: [{ text: 'kh', weight: 1.0 }, { text: 'k', weight: 0.5 }],
    final: [{ text: 'k', weight: 1.0 }],
  },
  'ฆ': {
    char: 'ฆ', class: 'low',
    initial: [{ text: 'kh', weight: 1.0 }, { text: 'k', weight: 0.5 }],
    final: [{ text: 'k', weight: 1.0 }],
  },
  'ง': {
    char: 'ง', class: 'low',
    initial: [{ text: 'ng', weight: 1.0 }],
    final: [{ text: 'ng', weight: 1.0 }],
  },
  'ช': {
    char: 'ช', class: 'low',
    initial: [{ text: 'ch', weight: 1.0 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ซ': {
    char: 'ซ', class: 'low',
    initial: [{ text: 's', weight: 1.0 }, { text: 'z', weight: 0.3 }],
    final: [{ text: 't', weight: 1.0 }, { text: 's', weight: 0.3 }],
  },
  'ฌ': {
    char: 'ฌ', class: 'low',
    initial: [{ text: 'ch', weight: 1.0 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ญ': {
    char: 'ญ', class: 'low',
    initial: [{ text: 'y', weight: 1.0 }],
    final: [{ text: 'n', weight: 1.0 }],
  },
  'ฑ': {
    char: 'ฑ', class: 'low',
    initial: [{ text: 'th', weight: 1.0 }, { text: 't', weight: 0.4 }, { text: 'd', weight: 0.3 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ฒ': {
    char: 'ฒ', class: 'low',
    initial: [{ text: 'th', weight: 1.0 }, { text: 't', weight: 0.4 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ณ': {
    char: 'ณ', class: 'low',
    initial: [{ text: 'n', weight: 1.0 }],
    final: [{ text: 'n', weight: 1.0 }],
  },
  'ท': {
    char: 'ท', class: 'low',
    initial: [{ text: 'th', weight: 1.0 }, { text: 't', weight: 0.5 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'ธ': {
    char: 'ธ', class: 'low',
    initial: [{ text: 'th', weight: 1.0 }, { text: 't', weight: 0.5 }],
    final: [{ text: 't', weight: 1.0 }],
  },
  'น': {
    char: 'น', class: 'low',
    initial: [{ text: 'n', weight: 1.0 }],
    final: [{ text: 'n', weight: 1.0 }],
  },
  'พ': {
    char: 'พ', class: 'low',
    initial: [{ text: 'ph', weight: 1.0 }, { text: 'p', weight: 0.5 }],
    final: [{ text: 'p', weight: 1.0 }],
  },
  'ฟ': {
    char: 'ฟ', class: 'low',
    initial: [{ text: 'f', weight: 1.0 }],
    final: [{ text: 'p', weight: 1.0 }],
  },
  'ภ': {
    char: 'ภ', class: 'low',
    initial: [{ text: 'ph', weight: 1.0 }, { text: 'p', weight: 0.5 }],
    final: [{ text: 'p', weight: 1.0 }],
  },
  'ม': {
    char: 'ม', class: 'low',
    initial: [{ text: 'm', weight: 1.0 }],
    final: [{ text: 'm', weight: 1.0 }],
  },
  'ย': {
    char: 'ย', class: 'low',
    initial: [{ text: 'y', weight: 1.0 }],
    final: [{ text: 'i', weight: 1.0 }, { text: 'y', weight: 0.7 }],
  },
  'ร': {
    char: 'ร', class: 'low',
    initial: [{ text: 'r', weight: 1.0 }, { text: 'l', weight: 0.3 }],
    final: [{ text: 'n', weight: 1.0 }, { text: 'r', weight: 0.4 }, { text: '', weight: 0.2 }],
  },
  'ล': {
    char: 'ล', class: 'low',
    initial: [{ text: 'l', weight: 1.0 }],
    final: [{ text: 'n', weight: 1.0 }, { text: 'l', weight: 0.4 }],
  },
  'ว': {
    char: 'ว', class: 'low',
    initial: [{ text: 'w', weight: 1.0 }, { text: 'v', weight: 0.3 }],
    final: [{ text: 'w', weight: 1.0 }, { text: 'o', weight: 0.3 }],
  },
  'ฬ': {
    char: 'ฬ', class: 'low',
    initial: [{ text: 'l', weight: 1.0 }],
    final: [{ text: 'n', weight: 1.0 }],
  },
  'ฮ': {
    char: 'ฮ', class: 'low',
    initial: [{ text: 'h', weight: 1.0 }],
    final: [],
  },
};
