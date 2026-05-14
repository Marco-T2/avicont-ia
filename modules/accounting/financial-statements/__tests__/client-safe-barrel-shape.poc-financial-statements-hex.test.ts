import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Client/server boundary guard — anti-regression sentinel.
 *
 * WHY: `modules/accounting/financial-statements/presentation/index.ts` is the
 * "client-safe" barrel. Client Components do `import type { ... }` from it. But a
 * barrel is ONE module — if it has ANY runtime re-export that transitively imports
 * `@/generated/prisma/client` (Prisma 7 → `node:module`), the whole barrel poisons
 * every client chunk that touches it, even type-only consumers. `pnpm build` then
 * fails with: "the chunking context (unknown) does not support external modules
 * (request: node:module)".
 *
 * The historical leak: `index.ts` re-exported `serializeStatement` from
 * `../domain/money.utils` (which runtime-imports Prisma). It was mislabeled
 * "environment-neutral" — it actually does `instanceof Prisma.Decimal`.
 *
 * This test walks the REAL transitive import graph from each client-safe barrel
 * (and from the "use client" components that consume them) and fails if any path
 * reaches `@/generated/prisma` or a `node:` builtin.
 *
 * Sibling barrels (trial-balance, equity-statement, worksheet, initial-balance)
 * are TYPE-only today — included here so the guard catches a future runtime
 * re-export regression in any of them.
 *
 * Pattern: fs.readFileSync + static import-graph walk (sibling sentinels:
 * c3-presentation-shape, c5-wholesale-delete-shape).
 */

const ROOT = path.resolve(__dirname, "../../../..");

// ── Forbidden transitive targets (browser-incompatible) ──────────────────────
// Only VALUE imports/re-exports matter: `import type` / `export type` are erased
// by the TS compiler and never reach a bundle. A type-only `import type { Prisma }`
// is client-safe; a value `export { serializeStatement }` from a Prisma file is not.
const FORBIDDEN_TARGET = String.raw`(@\/generated\/prisma[^"']*|node:[^"']*)`;
// `import "node:..."` (side-effect) — always a value import.
const FORBIDDEN_BARE = new RegExp(String.raw`import\s+["']${FORBIDDEN_TARGET}["']`);
// `import ... from "..."` / `export ... from "..."` that is NOT `import type` /
// `export type`. Negative lookahead after the keyword strips the type-only forms.
const FORBIDDEN_VALUE = new RegExp(
  String.raw`(?:import|export)\s+(?!type\s)[^;'"]*from\s+["']${FORBIDDEN_TARGET}["']`,
);

// ── Module resolution (subset sufficient for the accounting source tree) ─────
const EXTS = [".ts", ".tsx", ".js", ".jsx"];

function resolveImport(fromFile: string, spec: string): string | null {
  // Only follow first-party imports — node_modules / bare packages are not walked
  // (a barrel reaching a server-only NPM package is a different failure class;
  // Prisma is reached via the @/generated alias, which we DO follow).
  let base: string;
  if (spec.startsWith("@/")) {
    base = path.join(ROOT, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    return null;
  }

  for (const ext of EXTS) {
    if (fs.existsSync(base + ext)) return base + ext;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of EXTS) {
      const idx = path.join(base, "index" + ext);
      if (fs.existsSync(idx)) return idx;
    }
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  return null;
}

// VALUE import/re-export edges only — `import type` / `export type` are erased
// and must NOT be followed (the imported file never enters the runtime graph).
// Matches: `import ... from "x"`, `export ... from "x"`, `import "x"` — each
// without a `type ` keyword immediately after import/export.
const VALUE_EDGE = new RegExp(
  String.raw`(?:` +
    String.raw`(?:import|export)\s+(?!type\s)[^;'"]*from\s+["']([^"']+)["']` +
    String.raw`|import\s+["']([^"']+)["']` +
    String.raw`)`,
  "g",
);

/**
 * Walks the transitive VALUE import graph from `entry`. Returns the first path
 * that reaches a forbidden module, or null if the subgraph is client-safe.
 * `entry` itself is checked too. Type-only edges are intentionally not followed.
 */
function findForbiddenPath(entry: string): string[] | null {
  const visited = new Set<string>();
  const stack: Array<{ file: string; trail: string[] }> = [
    { file: entry, trail: [entry] },
  ];

  while (stack.length > 0) {
    const { file, trail } = stack.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    const src = fs.readFileSync(file, "utf8");

    if (FORBIDDEN_VALUE.test(src) || FORBIDDEN_BARE.test(src)) {
      return trail;
    }

    let m: RegExpExecArray | null;
    VALUE_EDGE.lastIndex = 0;
    while ((m = VALUE_EDGE.exec(src)) !== null) {
      const spec = m[1] ?? m[2];
      if (!spec) continue;
      const resolved = resolveImport(file, spec);
      if (resolved && !visited.has(resolved)) {
        stack.push({ file: resolved, trail: [...trail, resolved] });
      }
    }
  }

  return null;
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

// ── Client-safe barrels (must NOT transitively reach Prisma / node:) ─────────
const CLIENT_SAFE_BARRELS = [
  "modules/accounting/financial-statements/presentation/index.ts",
  "modules/accounting/trial-balance/presentation/index.ts",
  "modules/accounting/equity-statement/presentation/index.ts",
  "modules/accounting/worksheet/presentation/index.ts",
  "modules/accounting/initial-balance/presentation/index.ts",
];

// ── "use client" components consuming the financial-statements barrel ────────
const CLIENT_COMPONENTS = [
  "components/financial-statements/statement-filters.tsx",
  "components/financial-statements/statement-table.tsx",
  "components/financial-statements/balance-sheet-page-client.tsx",
  "components/financial-statements/income-statement-page-client.tsx",
];

describe("client/server boundary guard — no Prisma / node: in client-safe graph", () => {
  describe("client-safe barrels", () => {
    for (const barrel of CLIENT_SAFE_BARRELS) {
      it(`${barrel} does not transitively import @/generated/prisma or node:*`, () => {
        const entry = path.join(ROOT, barrel);
        expect(fs.existsSync(entry)).toBe(true);

        const leak = findForbiddenPath(entry);
        expect(
          leak,
          leak
            ? `LEAK: client-safe barrel reaches a browser-incompatible module:\n  ${leak
                .map(rel)
                .join("\n  -> ")}`
            : "",
        ).toBeNull();
      });
    }
  });

  describe('"use client" financial-statements components', () => {
    for (const comp of CLIENT_COMPONENTS) {
      it(`${comp} does not transitively import @/generated/prisma or node:*`, () => {
        const entry = path.join(ROOT, comp);
        expect(fs.existsSync(entry)).toBe(true);
        expect(fs.readFileSync(entry, "utf8")).toMatch(/^["']use client["']/m);

        const leak = findForbiddenPath(entry);
        expect(
          leak,
          leak
            ? `LEAK: "use client" component reaches a browser-incompatible module:\n  ${leak
                .map(rel)
                .join("\n  -> ")}`
            : "",
        ).toBeNull();
      });
    }
  });

  it("financial-statements client-safe barrel does NOT runtime re-export serializeStatement", () => {
    // Pinpoint guard for the exact historical leak: serializeStatement is
    // server-only (instanceof Prisma.Decimal). It belongs in presentation/server.ts.
    const barrel = fs.readFileSync(
      path.join(
        ROOT,
        "modules/accounting/financial-statements/presentation/index.ts",
      ),
      "utf8",
    );
    expect(barrel).not.toMatch(/export\s*\{[^}]*serializeStatement/);
  });
});
