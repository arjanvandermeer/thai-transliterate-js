/**
 * Shared CLI argument parsing utility.
 */

const args = process.argv.slice(2);

/**
 * Get the value of a CLI flag (e.g., --input path/to/file).
 * @param {string} name - flag name (e.g., '--input')
 * @param {string} [fallback] - default value if flag not found
 * @returns {string|undefined}
 */
export function argValue(name, fallback) {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return idx + 1 < args.length ? args[idx + 1] : fallback;
}

/** Check if a boolean flag is present (e.g., --json) */
export function hasFlag(name) {
  return args.includes(name);
}
