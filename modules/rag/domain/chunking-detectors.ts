/**
 * Pure regex detectors for the chunker cascade (REQ-33, REQ-36).
 *
 * Sibling pure-fn module so RED tests can lock each regex independently
 * (per design §2). Cascade ordering (markdown > numbered > all-caps >
 * fallback) is enforced in chunking.ts, NOT here.
 *
 * Locks per [[textual_rule_verification]]:
 * - NUMBERED_CODE_REGEX = /^\d+(\.\d+)*\s+[A-ZÁÉÍÓÚÑ]/ — REQ-36 literal.
 * - MD_HEADER_REGEX     = /^(#+)\s+(.+)$/ — capture group 1 = level (#-count),
 *                                            capture group 2 = title.
 * - ALL_CAPS_REGEX      = /^[A-ZÁÉÍÓÚÑ0-9\s.\-]+$/ — charset gate only;
 *                          line-length (≤60) and uppercase-letter count (≥3)
 *                          enforced by caller.
 */

export const MD_HEADER_REGEX = /^(#+)\s+(.+)$/;
export const NUMBERED_CODE_REGEX = /^\d+(\.\d+)*\s+[A-ZÁÉÍÓÚÑ]/;
export const ALL_CAPS_REGEX = /^[A-ZÁÉÍÓÚÑ0-9\s.\-]+$/;

/** Max char count for sectionPath before clip (RESOLVED-4). */
export const SECTION_PATH_MAX = 512;

/** Lower bound for uppercase letters in a candidate all-caps section title. */
export const ALL_CAPS_MIN_UPPER = 3;

/** Upper bound for line length in a candidate all-caps section title. */
export const ALL_CAPS_MAX_LEN = 60;

/**
 * Build the canonical sectionPath from a markdown ancestor stack + an
 * optional non-markdown leaf (numbered or all-caps). Returns null when
 * both inputs are empty.
 *
 * RESOLVED-4: when the joined string exceeds SECTION_PATH_MAX, clip to
 * the LAST `SECTION_PATH_MAX - 1` chars and prefix with `"…"` so the
 * deepest (most specific) context survives.
 */
export function buildSectionPath(
  stack: readonly string[],
  leaf: string | null,
): string | null {
  const parts: string[] = [];
  for (const segment of stack) {
    if (segment.length > 0) parts.push(segment);
  }
  if (leaf && leaf.length > 0) parts.push(leaf);

  if (parts.length === 0) return null;

  const joined = parts.join(" > ");
  if (joined.length <= SECTION_PATH_MAX) return joined;

  // Clip: keep last (MAX - 1) chars (room for the ellipsis prefix).
  return "…" + joined.slice(-(SECTION_PATH_MAX - 1));
}

/**
 * Returns the all-caps title if `line` qualifies (charset, length ≤60,
 * ≥3 uppercase letters). Returns null otherwise. Whitespace-only and
 * pure-digit lines are rejected.
 */
export function detectAllCaps(line: string): string | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > ALL_CAPS_MAX_LEN) return null;
  ALL_CAPS_REGEX.lastIndex = 0;
  if (!ALL_CAPS_REGEX.test(trimmed)) return null;
  const upperCount = (trimmed.match(/[A-ZÁÉÍÓÚÑ]/g) ?? []).length;
  if (upperCount < ALL_CAPS_MIN_UPPER) return null;
  return trimmed;
}
