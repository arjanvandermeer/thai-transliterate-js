/**
 * Shared filtering utilities for calibration extractors.
 */

export const THAI_RE = /[\u0E01-\u0E5B]/;
export const LATIN_START_RE = /^[A-Za-z]/;

/**
 * Check if a string contains Thai characters.
 */
export function hasThai(str) {
  return str && THAI_RE.test(str);
}

/**
 * Detect ISO 11940 machine transliterations.
 * These use: x for sara oe, æ, and produce sequences like khlxng, dxy, hwy.
 * They're always all-lowercase with no capitals.
 */
export function isIsoTransliteration(name) {
  if (!LATIN_START_RE.test(name)) return false;
  if (name !== name.toLowerCase()) return false;
  if (/[xæ]/.test(name)) return true;
  if (/(?:hwy|khlxng|thung|khea|phel|helk|ywn|dxy)/.test(name)) return true;
  return false;
}

/**
 * Check if a Latin name should be filtered out.
 */
export function isJunkLatin(name) {
  if (!name || name.length < 2) return true;
  if (THAI_RE.test(name)) return true;
  if (!LATIN_START_RE.test(name)) return true;
  if (/^[A-Z]{2,4}$/.test(name)) return true;
  if (isIsoTransliteration(name)) return true;
  if (/[^\x20-\x7E]/.test(name)) return true;
  if (/^[A-Za-z]+\d+$/.test(name)) return true;
  return false;
}

/**
 * Check if a string is a plausible Latin romanization.
 */
export function isValidLatin(str) {
  if (!str || str.length < 2) return false;
  if (!LATIN_START_RE.test(str)) return false;
  if (THAI_RE.test(str)) return false;
  if (/[^\x20-\x7E]/.test(str)) return false;
  return true;
}
