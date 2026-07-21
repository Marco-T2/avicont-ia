/**
 * Feature Module Boundaries — TERMINAL sentinel.
 *
 * WHY THIS FILE SHRANK TO THREE ASSERTIONS
 * Every REQ-FMB rule this file used to carry (FMB.3 "no Repository/Service in a
 * feature barrel", FMB.4 "no cross-feature deep imports", FMB.5 "no deep imports
 * from app/ into feature internals") constrained code living INSIDE `features/`.
 * Those rules are now VACUOUSLY satisfied by a strictly STRONGER invariant:
 *
 *     `features/` does not exist, and nothing may import through it.
 *
 * A directory that cannot exist cannot host a leaky barrel, a cross-feature deep
 * import, or a Repository re-export. So the old rules were not weakened — they
 * were subsumed. Keeping them would mean maintaining scanners over an empty set,
 * which is how a sentinel rots into a permanently-green no-op.
 *
 * WHY NOT JUST DELETE THE FILE
 * Deleting it would leave NOTHING stopping someone from recreating `features/`
 * and reopening the whole rule surface. The guard has to outlive the rules it
 * replaced. Hence: a file, not the rules.
 *
 * HAZARD THIS FILE DELIBERATELY AVOIDS
 * Regex sentinels over raw source in this repo have repeatedly gone green (or
 * red) on COMMENT PROSE rather than real code — including on prose in sentinels
 * documenting the very paths they forbid. α2 therefore reads MODULE SOURCE with
 * comments STRIPPED via the shared `stripSourceComments()` helper, and anchors
 * every pattern to a real statement position instead of matching a bare
 * substring. See modules/shared/__tests__/strip-source-comments.ts.
 *
 * RULE — NEVER COMMENT-STRIP A CONFIG FILE, IN ANY FORMAT
 * `stripSourceComments()` is a naive stripper: it does not parse string
 * literals, so `/*` and `*\/` INSIDE a string are treated as comment
 * delimiters. Config files are structurally adversarial input for it, because
 * ANY config that talks about paths carries glob strings — `"@/*"`,
 * `"**\/*.ts"`, `"@/features/*\/server"`. The first such string opens a PHANTOM
 * BLOCK COMMENT that runs to the next `*\/` and silently deletes an arbitrary
 * span of the file, including the very declaration under test. The assertion
 * then passes over a hole and is VACUOUS while reporting GREEN.
 *
 * This is not hypothetical and it is not one unlucky file. Measured on the
 * tree as it stands: `stripSourceComments(vitest.config.ts)` deletes 911 of
 * 2055 characters and mangles all five `include` globs —
 * `"components/**\/__tests__/**\/*.test.tsx"` collapses to
 * `"components__tests__*.test.tsx"`. It was previously argued that stripping
 * the `.ts` configs was "safe because they carry no path globs today". That
 * claim was FALSE when written, and the danger was not merely latent.
 *
 * Inserting a features alias at each of the 58 line boundaries of
 * vitest.config.ts left the old check RED at every one, which is what made the
 * hazard look theoretical. It is not. The stripper's regex needs a CLOSING
 * `*\/` to delete anything, so a glob whose `/*` never closes (`"@/*"`) is
 * inert on its own — but pair it with any later glob that supplies the `*\/`
 * (`"**\/*.test.ts"`, already present here) and the entire span between them
 * is deleted. Respelling the catch-all alias key tsconfig-style — `"@"` →
 * `"@/*"`, a two-character edit, and the spelling tsconfig.json itself already
 * uses — reduces the whole alias block to `"@__tests__*.test.ts"`. With a LIVE
 * `"@/features/*": path.resolve(__dirname, "features")` sitting in the file,
 * the old assertion reported GREEN. That is a reproduced live vacuity on the
 * real file, one plausible edit away — not a position accident.
 *
 * HOW THIS IS NOW CLOSED — ASSERT ON TOKENS, NOT ON TEXT
 * The fix is not a fourth, cleverer regex. Three rounds of regex escalation on
 * this one assertion is the signal that the assertion was being made against
 * the WRONG TEXT. α3 no longer looks at raw source at all:
 *   - JSON-shaped config (tsconfig.json, …) → parse STRUCTURALLY (JSON.parse)
 *     and inspect the real `compilerOptions.paths` keys. Never regex, never
 *     strip. This path is unchanged; it was already correct.
 *   - JS-shaped config (.ts/.mts/.cts/.mjs/.cjs/.js) → run `stringLiterals()`,
 *     a single-pass scanner that tracks line comments, block comments and
 *     string/template literals, and returns the set of STRING LITERAL VALUES.
 *     The assertion then runs over those VALUES.
 *
 * Two properties fall out of that, and they are the whole point:
 *   1. A comment is no longer a place a match can HIDE, so there is nothing to
 *      strip. The "never comment-strip a config" rule above is now true BY
 *      CONSTRUCTION rather than by author discipline — `stripSourceComments()`
 *      is not reachable from this assertion at all.
 *   2. A comment is no longer a place a match can FALSELY FIRE. The old
 *      quote-anchored regex `/["'`]@\/features(\/|["'`])/` drove RED on prose
 *      whenever a quote happened to sit adjacent to the path, e.g.
 *      `// we used to ban "@/features/*\/server" here`. eslint.config.mjs:9
 *      was ONE SPACE from that failure: it survived only because its quote
 *      opens before the word "client", not before the `@`. An editorial reflow
 *      would have turned a file declaring no alias at all bright RED.
 *
 * The matcher over token values is anchored at the START of the literal
 * (`/^@\/features(\/|$)/`), because a real alias key or module specifier IS
 * the whole string, while an error `message:` that merely mentions the path
 * carries it mid-sentence.
 *
 * KNOWN LIMITS OF `stringLiterals()` — stated honestly
 * It is a scanner, not a parser. It over-reports rather than misses, and it is
 * TEMPTING to call that bias inherently safe — "a false RED is loud, a miss is
 * silent". THAT IS NOT TRUE HERE, and the reason is the anchoring above.
 * FEATURES_ALIAS is anchored at the START of the literal. So an over-report
 * that MERGES a real alias into a larger surrounding literal pushes the alias
 * off position 0, and the anchor stops matching. A merging over-report does not
 * degrade into a false RED — it degrades into a silent MISS, the exact failure
 * mode this file exists to prevent. Reproduced, both GREEN:
 *
 *     if (f(a) /`/.test(z)) {}
 *     const b = "@/features/z";
 *     → literals = ["/.test(z)) {}\nconst b = \"@/features/z\";"]
 *
 *     const r = arr[0] /`/;
 *     const b = "@/features/z";
 *
 * This is an INTERACTION, not a defect in either half. The scanner alone is
 * fine; the start-anchor alone is fine and is what keeps an error `message:`
 * that merely mentions the path from driving RED. The miss only exists because
 * the two are combined. Anyone loosening the anchor OR the scanner must
 * re-check the pair, not just the piece they touched.
 *
 * Specifically:
 *   - Template literals are captured WHOLE, including `${…}` interpolation
 *     text. Code inside an interpolation is treated as string content.
 *   - Regex-vs-division is resolved by the usual previous-significant-character
 *     heuristic, so a regex in an unusual position (directly after `)` or `]`)
 *     is read as division and its body is scanned as code. The dangerous
 *     character inside such a body is the BACKTICK: it opens a phantom
 *     TEMPLATE literal, and templates legally cross newlines, so the phantom
 *     swallows arbitrarily far — merging any later alias and producing the miss
 *     above. A stray double quote does NOT do this: the quoted-string branch
 *     breaks on `\n`, so a phantom `"`-string is bounded to its own line and a
 *     following alias is still emitted as its own literal (verified RED).
 *   - Reachability: pathological JS only. It needs a regex literal placed where
 *     the heuristic reads division, containing an unpaired backtick, sharing a
 *     file with a real alias. No realistic config is written that way; all 7
 *     current root configs scan to ZERO multiline literals. Real, not urgent —
 *     do not restate it as "safe".
 *   - Escapes are not evaluated beyond `\x` → `x`. A literal written with an
 *     escaped `@` — backslash-u-0-0-4-0 followed by `/features/*` — is a valid
 *     JS string whose VALUE is `@/features/*`, but the scanner yields
 *     `u0040/features/*` and the anchor misses. Accepted: this requires an
 *     adversary deliberately encoding the alias; it is not something a
 *     maintainer writes by accident.
 *   - Root `.d.ts` files are excluded from the scan, so a
 *     `declare module "@/features/x"` in a root `.d.ts` would not be caught.
 *     Accepted: a `.d.ts` cannot declare a build alias, and the only root
 *     `.d.ts` is the generated `next-env.d.ts`.
 *
 * α3 enforces all of this. An earlier draft of α3 comment-stripped
 * tsconfig.json and was silently vacuous with a live
 * `"@/features/*": ["./features/*"]` alias sitting in the file.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { stripSourceComments } from "@/modules/shared/__tests__/strip-source-comments";

const REPO_ROOT = path.resolve(__dirname, "..");
const FEATURES_DIR = path.resolve(REPO_ROOT, "features");

/** Directories never walked — vendored, generated, or build output. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "dist",
  "build",
  ".turbo",
  ".vercel",
]);

/**
 * Test files are excluded from the α2 scan on purpose: sentinels legitimately
 * quote forbidden specifiers as *data* (e.g. `existsSync("features/audit/...")`
 * assertions that the path is GONE). Those strings must stay legal.
 */
function isTestFile(relPath: string): boolean {
  const segments = relPath.split(path.sep);
  if (segments.includes("__tests__") || segments.includes("__mocks__")) return true;
  const base = segments[segments.length - 1];
  return (
    /\.(test|spec)\.tsx?$/.test(base) ||
    base === "vitest.setup.ts" ||
    base === "vitest.config.ts"
  );
}

function collectProductionSources(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectProductionSources(path.join(dir, entry.name), acc);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (isTestFile(path.relative(REPO_ROOT, full))) continue;
    acc.push(full);
  }
  return acc;
}

/**
 * Anchored, multi-line-aware matchers for a module specifier under `@/features/`.
 *
 * `[^;]*?` inside the static-import pattern is what makes
 *     import {
 *       a,
 *       b,
 *     } from "@/features/x";
 * match, while the `;` exclusion keeps the match from running past the end of
 * the statement and gluing two unrelated lines together.
 */
const FORBIDDEN_SPECIFIER_PATTERNS: readonly RegExp[] = [
  // import ... from "@/features/..."  /  export ... from "@/features/..."
  /^[ \t]*(?:import|export)\b[^;]*?\bfrom[ \t\r\n]*["'`]@\/features\//gm,
  // side-effect: import "@/features/..."
  /^[ \t]*import[ \t\r\n]*["'`]@\/features\//gm,
  // dynamic: import("@/features/...") / require("@/features/...")
  /\b(?:import|require)[ \t\r\n]*\([ \t\r\n]*["'`]@\/features\//g,
];

/**
 * Single-pass scanner returning every STRING LITERAL VALUE in JS/TS source.
 *
 * Comments are consumed and DISCARDED rather than blanked, so no comment
 * content can reach the caller — which is what lets α3 assert without ever
 * stripping a config file. See this file's header for the deliberate
 * over-report bias and the exact known limits.
 */
function stringLiterals(src: string): string[] {
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

    // ── quoted string literals ──
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

/** A retired-layer alias/specifier IS the whole literal, never mid-sentence. */
const FEATURES_ALIAS = /^@\/features(\/|$)/;

function findForbiddenImports(): string[] {
  const offenders: string[] = [];
  for (const file of collectProductionSources(REPO_ROOT)) {
    const source = stripSourceComments(fs.readFileSync(file, "utf8"));
    const hit = FORBIDDEN_SPECIFIER_PATTERNS.some((re) => {
      re.lastIndex = 0;
      return re.test(source);
    });
    if (hit) offenders.push(path.relative(REPO_ROOT, file).split(path.sep).join("/"));
  }
  return offenders;
}

describe("Feature Module Boundaries — features/ is retired", () => {
  /**
   * WHAT α1 ABSORBED — do NOT re-add per-feature absence sentinels.
   *
   * A family of per-file sentinels used to assert `!existsSync("features/<x>")`
   * one path at a time, scattered across module POC shape tests. Every one of
   * them is implied by this single assertion: if `features/` does not exist, no
   * path beneath it can. They were deleted as redundant, NOT because coverage
   * was dropped. Removed here, by origin file:
   *
   *   modules/audit/.../c5-wholesale-delete-shape.poc-audit.test.ts
   *     α40–α46 — features/audit/{server,index,audit.service,audit.repository,
   *               audit.types,audit.classifier,audit.validation}.ts
   *   modules/org-profile/.../c5-wholesale-delete-shape.poc-org-profile-hex.test.ts
   *     α47–α52 — features/org-profile/{server,index,org-profile.types,
   *               org-profile.validation,org-profile.service,org-profile.repository}.ts
   *   modules/rag/.../poc-quick-cleanup-rag-shape.test.ts
   *     α06–α10 — features/documents/rag/*
   *     α15     — features/ai-agent/__tests__/agent.context.dispatch.test.ts
   *   modules/contacts/.../c4-cutover-wholesale-delete-shape.poc-nuevo-contacts.test.ts
   *     Tests 1–3   — features/contacts/*
   *     Tests 15–18 — features/ai-agent/__tests__/tools.{find-contact,parse-operation}.test.ts
   *   modules/documents/.../c3-presentation-shape.poc-documents-hex.test.ts
   *     α35–α36 — features/documents/server.ts (both, same path)
   *   modules/mortality/.../c1-cutover-shape.poc-nuevo-mortality.test.ts
   *     Test 9  — features/mortality/ directory
   *   modules/org-profile/.../c4-cross-feature-cutover-shape.poc-org-profile-hex.test.ts
   *     α42     — features/accounting/journal.service.ts
   *   modules/document-signature-config/.../c4-cross-feature-cutover-shape....test.ts
   *     α39     — features/accounting/journal.service.ts
   *
   * 31 assertions, all strictly weaker than α1. What was deliberately KEPT and
   * is NOT covered here: every sentinel that reads SOURCE CONTENT rather than
   * the filesystem — the "zero production source imports from @/features/<x>"
   * scanners and the per-component "does NOT import from @/features/<x>"
   * checks. Those constrain files under app/, components/ and modules/, which
   * α1 says nothing about. α2 covers that surface for production code, but α2
   * excludes tests by design, so the per-file checks are not redundant with it
   * either. Do not delete them on the strength of this note.
   */
  it("α1: the features/ directory does not exist at the repo root", () => {
    expect(
      fs.existsSync(FEATURES_DIR),
      "`features/` is retired. Its last inhabitant (features/shared/index.ts, a " +
        "bare re-export of @/modules/shared/presentation/middleware) was deleted. " +
        "New code belongs under modules/<context>/ following the hex layout.",
    ).toBe(false);
  });

  it("α2: no production .ts/.tsx file imports through @/features/", () => {
    const offenders = findForbiddenImports();
    expect(
      offenders,
      `\n${offenders.length} file(s) still import through the retired @/features/ alias:\n` +
        offenders.map((f) => `  ${f}`).join("\n") +
        `\n\nFix: import from the owning module directly, e.g.\n` +
        `  @/modules/shared/presentation/middleware  (requireAuth)\n` +
        `  @/modules/shared/presentation/http-error-serializer  (handleError)\n`,
    ).toHaveLength(0);
  });

  it("α3: no build/test config declares an @/features/* path alias", () => {
    // tsconfig only ever declared the catch-all `@/*`; vitest.config.ts only ever
    // declared `@`. This asserts no one ADDS a dedicated features alias to
    // resurrect the layer behind α2's back.
    //
    // tsconfig.json is parsed STRUCTURALLY, never regex-over-stripped-source.
    // stripSourceComments() is a naive stripper that does not parse string
    // literals (it says so in its own header), and tsconfig is adversarial input
    // for it: the `/*` inside `"@/*"` opens a phantom block comment that runs to
    // the `*/` inside `"**/*.ts"`, deleting the entire `paths` block. An earlier
    // draft of this assertion did exactly that and was silently VACUOUS — it
    // stayed green with `"@/features/*": ["./features/*"]` sitting in the file.
    const offenders: string[] = [];

    const tsconfigPath = path.resolve(REPO_ROOT, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      const raw = fs.readFileSync(tsconfigPath, "utf8");
      const paths: Record<string, unknown> =
        JSON.parse(raw)?.compilerOptions?.paths ?? {};
      if (Object.keys(paths).some((alias) => /^@\/features(\/|$)/.test(alias))) {
        offenders.push("tsconfig.json");
      }
    }

    // ── every JS-shaped root config — ONE code path, tokenized ──
    // .ts and .mjs/.cjs/.js used to be handled by two different strategies
    // (comment-strip vs quote-anchored regex on raw text); both were wrong in
    // opposite directions. They are now the SAME path: scan to string literal
    // values, assert on the values. Comments never reach the matcher, so
    // nothing can hide in one and nothing can falsely fire from one.
    //
    // eslint.config.mjs previously declared live `"@/features/*/server"`
    // no-restricted-imports patterns over the retired layer; nothing caught it,
    // because α3 did not look at .mjs at all. The set is ENUMERATED, not
    // hardcoded, so a newly added root config is covered the day it lands.
    // `.d.ts` is excluded: it is generated and declares no aliases.
    const rootModules = fs
      .readdirSync(REPO_ROOT, { withFileTypes: true })
      .filter(
        (e) =>
          e.isFile() &&
          /\.(mts|cts|ts|mjs|cjs|js)$/.test(e.name) &&
          !e.name.endsWith(".d.ts"),
      )
      .map((e) => e.name)
      .sort();

    for (const rel of rootModules) {
      const raw = fs.readFileSync(path.resolve(REPO_ROOT, rel), "utf8");
      if (stringLiterals(raw).some((v) => FEATURES_ALIAS.test(v))) {
        offenders.push(rel);
      }
    }

    expect(
      offenders,
      "A config re-declared an @/features/* alias. The layer is retired — remove it.",
    ).toHaveLength(0);
  });
});
