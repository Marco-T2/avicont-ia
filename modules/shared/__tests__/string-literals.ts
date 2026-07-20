/**
 * Shared sentinel helper — extract STRING LITERAL VALUES from JS/TS source.
 *
 * WHY THIS EXISTS (read this before reaching for `stripSourceComments()`)
 * `stripSourceComments()` is a NAIVE stripper: it does not parse string
 * literals, so a `/*` or `*\/` INSIDE a string is treated as a comment
 * delimiter. Config files are structurally adversarial input for it, because
 * any config that talks about paths carries glob strings — `"@/*"`,
 * `"**\/infrastructure/*"`, `"**\/*.test.ts"`. The first such string opens a
 * PHANTOM BLOCK COMMENT that runs to the next `*\/` and silently deletes an
 * arbitrary span of the file, INCLUDING THE DECLARATION UNDER TEST. The
 * assertion then passes over a hole: GREEN while pinning nothing.
 *
 * This is measured, not hypothetical. On this tree,
 * `stripSourceComments(vitest.config.ts)` deletes 911 of 2055 characters. See
 * the full write-up in `__tests__/feature-boundaries.test.ts` (header,
 * lines 30-59) — that sentinel reproduced a LIVE vacuity from exactly this.
 *
 * `eslint.config.mjs` is the worst case in the repo: its `no-restricted-imports`
 * groups are nothing BUT `"**\/infrastructure/*"`-shaped globs sitting a few
 * lines above the `message:` strings a sentinel wants to assert on.
 *
 * THE FIX IS NOT A CLEVERER REGEX — IT IS ASSERTING ON TOKENS
 * This is a single-pass scanner that tracks line comments, block comments,
 * string literals, template literals and regex literals, and returns the set of
 * STRING LITERAL VALUES. Two properties fall out, and they are the whole point:
 *   1. A comment is not a place a match can HIDE — comments are consumed and
 *      DISCARDED, never emitted, so there is nothing left to strip.
 *   2. A comment is not a place a match can FALSELY FIRE — prose that merely
 *      mentions a forbidden path never reaches the matcher.
 *
 * This is a verbatim extraction of the `stringLiterals()` that
 * `__tests__/feature-boundaries.test.ts` already carries privately. It was
 * lifted here so a second sentinel could reuse it WITHOUT editing that file;
 * feature-boundaries.test.ts keeps its own copy on purpose, because rewiring a
 * load-bearing sentinel to prove a point about a NEW sentinel is how you break
 * the old one. If you change the scanner, change both, and re-read the limits.
 *
 * KNOWN LIMITS — stated honestly, do NOT restate these as "safe"
 * It is a scanner, not a parser. It OVER-REPORTS rather than misses. That bias
 * is tempting to call inherently safe ("a false RED is loud, a miss is
 * silent"). THAT IS NOT TRUE when the caller ANCHORS its matcher at the start
 * of the literal (`/^…/`): an over-report that MERGES a real literal into a
 * larger surrounding one pushes it off position 0, and the anchor stops
 * matching — a silent MISS. Anchoring and scanning are safe individually; the
 * miss only exists when combined. Anyone loosening either must re-check BOTH.
 *
 *   - Template literals are captured WHOLE, `${…}` interpolation text included.
 *   - Regex-vs-division is resolved by the previous-significant-character
 *     heuristic, so a regex in an unusual position (directly after `)` or `]`)
 *     is read as division and its body scanned as code. The dangerous character
 *     inside such a body is the BACKTICK: it opens a phantom TEMPLATE literal,
 *     and templates legally cross newlines, so the phantom swallows arbitrarily
 *     far. A stray double quote does NOT do this — the quoted-string branch
 *     breaks on `\n`, bounding a phantom `"`-string to its own line.
 *   - Reachability of that miss: pathological JS only. It needs a regex literal
 *     placed where the heuristic reads division, containing an unpaired
 *     backtick, sharing a file with the literal under test. Real, not urgent.
 *   - Escapes are not evaluated beyond `\x` → `x`. A literal written with an
 *     escaped character is a valid JS string whose VALUE differs from what the
 *     scanner yields. Requires a deliberate adversary, not an accident.
 */

/**
 * Returns every string / template literal VALUE in `src`, in source order.
 * Comments are consumed and discarded — none of their content is ever emitted.
 */
export function stringLiterals(src: string): string[] {
  const out: string[] = [];
  let prev = ""; // last significant (non-space, non-comment) character
  let i = 0;

  while (i < src.length) {
    const c = src[i];

    // ── comments: consumed, never emitted ──
    if (c === "/" && src[i + 1] === "/") {
      i += 2;
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    // ── quoted string literals (bounded to their own line, like real JS) ──
    if (c === '"' || c === "'") {
      let buf = "";
      i++;
      while (i < src.length) {
        const d = src[i];
        if (d === "\\") {
          buf += src[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (d === c || d === "\n") {
          i++;
          break;
        }
        buf += d;
        i++;
      }
      out.push(buf);
      prev = c;
      continue;
    }

    // ── template literals: captured WHOLE, `${…}` included (over-report) ──
    if (c === "`") {
      let buf = "";
      i++;
      while (i < src.length) {
        const d = src[i];
        if (d === "\\") {
          buf += src[i + 1] ?? "";
          i += 2;
          continue;
        }
        if (d === "`") {
          i++;
          break;
        }
        buf += d;
        i++;
      }
      out.push(buf);
      prev = "`";
      continue;
    }

    // ── bare `/`: regex literal or division ──
    if (c === "/") {
      if (/[)\]}\w$"'`]/.test(prev)) {
        i++; // division — nothing to capture
        prev = c;
        continue;
      }
      i++;
      let inClass = false;
      while (i < src.length) {
        const d = src[i];
        if (d === "\\") {
          i += 2;
          continue;
        }
        if (d === "[") inClass = true;
        else if (d === "]") inClass = false;
        else if (d === "/" && !inClass) {
          i++;
          break;
        } else if (d === "\n") break;
        i++;
      }
      while (i < src.length && /[a-z]/.test(src[i])) i++; // flags
      prev = "/";
      continue;
    }

    if (!/\s/.test(c)) prev = c;
    i++;
  }

  return out;
}
