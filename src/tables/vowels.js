/**
 * Thai vowel patterns with weighted romanization variants (RTGS + well-established only).
 * Each pattern has an ID used by the syllable parser and romanizer.
 *
 * Data-derived variants are in weight-overrides.json newVariants section,
 * merged at runtime by load-weights.js.
 */
export const VOWEL_PATTERNS = {
  // === COMPOUND / DIPHTHONG VOWELS ===

  sara_ia:       { id: 'sara_ia',       variants: [{ text: 'ia', weight: 1.0 }, { text: 'iya', weight: 0.4 }, { text: 'ea', weight: 0.3 }] },
  sara_ia_short: { id: 'sara_ia_short', variants: [{ text: 'ia', weight: 1.0 }] },
  sara_uea:      { id: 'sara_uea',      variants: [{ text: 'uea', weight: 1.0 }, { text: 'ua', weight: 0.6 }, { text: 'uer', weight: 0.3 }, { text: 'eua', weight: 0.3 }] },
  sara_uea_short:{ id: 'sara_uea_short',variants: [{ text: 'uea', weight: 1.0 }, { text: 'ua', weight: 0.5 }] },
  sara_ua:       { id: 'sara_ua',       variants: [{ text: 'ua', weight: 1.0 }, { text: 'uar', weight: 0.3 }] },
  sara_ua_short: { id: 'sara_ua_short', variants: [{ text: 'ua', weight: 1.0 }] },

  // === LEADING VOWELS ===

  sara_e_short:  { id: 'sara_e_short',  variants: [{ text: 'e', weight: 1.0 }] },
  sara_e:        { id: 'sara_e',        variants: [{ text: 'e', weight: 1.0 }, { text: 'ay', weight: 0.3 }, { text: 'ei', weight: 0.2 }] },
  sara_ae_short: { id: 'sara_ae_short', variants: [{ text: 'ae', weight: 1.0 }, { text: 'a', weight: 0.5 }, { text: 'e', weight: 0.3 }] },
  sara_ae:       { id: 'sara_ae',       variants: [{ text: 'ae', weight: 1.0 }, { text: 'a', weight: 0.5 }, { text: 'e', weight: 0.4 }] },
  sara_o_short:  { id: 'sara_o_short',  variants: [{ text: 'o', weight: 1.0 }] },
  sara_o:        { id: 'sara_o',        variants: [{ text: 'o', weight: 1.0 }, { text: 'oh', weight: 0.3 }] },
  sara_ai_malai: { id: 'sara_ai_malai', variants: [{ text: 'ai', weight: 1.0 }, { text: 'i', weight: 0.4 }, { text: 'ay', weight: 0.3 }] },
  sara_ai_muan:  { id: 'sara_ai_muan',  variants: [{ text: 'ai', weight: 1.0 }, { text: 'i', weight: 0.4 }, { text: 'ay', weight: 0.3 }] },
  sara_ao:       { id: 'sara_ao',       variants: [{ text: 'ao', weight: 1.0 }, { text: 'ow', weight: 0.4 }, { text: 'aw', weight: 0.3 }] },
  sara_oe:       { id: 'sara_oe',       variants: [{ text: 'oe', weight: 1.0 }, { text: 'er', weight: 0.6 }, { text: 'ur', weight: 0.4 }, { text: 'or', weight: 0.3 }] },
  sara_oe_short: { id: 'sara_oe_short', variants: [{ text: 'oe', weight: 1.0 }, { text: 'er', weight: 0.5 }] },

  // === ABOVE / BELOW VOWELS ===

  sara_i_short:  { id: 'sara_i_short',  variants: [{ text: 'i', weight: 1.0 }] },
  sara_i:        { id: 'sara_i',        variants: [{ text: 'i', weight: 1.0 }, { text: 'ee', weight: 0.4 }] },
  sara_ue_short: { id: 'sara_ue_short', variants: [{ text: 'ue', weight: 1.0 }, { text: 'eu', weight: 0.5 }, { text: 'u', weight: 0.3 }] },
  sara_ue:       { id: 'sara_ue',       variants: [{ text: 'ue', weight: 1.0 }, { text: 'eu', weight: 0.5 }, { text: 'oo', weight: 0.3 }, { text: 'u', weight: 0.3 }] },
  sara_u_short:  { id: 'sara_u_short',  variants: [{ text: 'u', weight: 1.0 }, { text: 'oo', weight: 0.4 }] },
  sara_u:        { id: 'sara_u',        variants: [{ text: 'u', weight: 1.0 }, { text: 'oo', weight: 0.5 }] },
  mai_han_akat:  { id: 'mai_han_akat',  variants: [{ text: 'a', weight: 1.0 }] },

  // === FOLLOWING VOWELS ===

  sara_a_short:  { id: 'sara_a_short',  variants: [{ text: 'a', weight: 1.0 }] },
  sara_a:        { id: 'sara_a',        variants: [{ text: 'a', weight: 1.0 }, { text: 'aa', weight: 0.3 }, { text: 'ar', weight: 0.2 }] },
  sara_am:       { id: 'sara_am',       variants: [{ text: 'am', weight: 1.0 }, { text: 'um', weight: 0.4 }], includesFinal: 'm' },

  // === IMPLIED VOWELS ===

  implied_o:     { id: 'implied_o',     variants: [{ text: 'o', weight: 0.8 }, { text: 'a', weight: 0.5 }] },
  implied_a:     { id: 'implied_a',     variants: [{ text: 'a', weight: 0.8 }, { text: 'o', weight: 0.4 }] },

  // === SPECIAL ===

  ro_han:        { id: 'ro_han',        variants: [{ text: 'an', weight: 1.0 }, { text: 'un', weight: 0.3 }], includesFinal: 'n' },
  ro_han_open:   { id: 'ro_han_open',   variants: [{ text: 'a', weight: 1.0 }] },
  rue:           { id: 'rue',           variants: [{ text: 'ri', weight: 1.0 }, { text: 'rue', weight: 0.6 }, { text: 'reu', weight: 0.4 }] },
};
