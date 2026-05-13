/**
 * C2 — Wholesale Delete: features/accounting/iva-books/ sentinel
 * poc-accounting-iva-books-hex · OLEADA 6 sub-POC 5/8
 *
 * Failure mode (pre-GREEN): FILE-STILL-EXISTS
 *   existsSync(path) returns true → expect(false) FAILS for files still present.
 *   Files already git-mv'd at C1 GREEN (already absent → PASS pre-RED):
 *     exporters/excel.exporter.ts → git mv'd as iva-book-xlsx.exporter.ts at C1
 *     exporters/sheet.builder.ts → git mv'd as iva-book-xlsx.sheet-builder.ts at C1
 *     __tests__/excel-exporter.test.ts → git mv'd as iva-book-xlsx.exporter.test.ts at C1
 *
 * Failure mode (post-GREEN): all assertions flip to PASS (existsSync returns false).
 *
 * Paired sister (closest): poc-accounting-initial-balance-hex C5 (commit 288aa2cd RED / 7baa839a GREEN, 28α)
 *
 * Scope: 13 spec files (5 src top-level + 2 exporters/ + 4 __tests__/ + 1 __tests__/excel-exporter)
 *        = 13 file existence assertions (α44..α56)
 *        + 1 directory non-existence (α57)
 *        + 1 REQ-001 FINAL global grep (α58)
 *        + 2 runtime path coverage (α59..α60) [[runtime_path_coverage_red_scope]]
 *        + 4 sibling modules clean (α61..α64)
 *        + 2 A2 sentinel retirement explicit (α65..α66) [[REQ-010 traceability]]
 *        + 2 C0 sentinels operational (α67..α68)
 *        + 3 presentation/server + domain shape (α69..α71)
 *        = 28α total
 *
 * PRE-C2 grep inventory [[retirement_reinventory_gate_features_inclusion]]:
 *   - git grep @/features/accounting/iva-books (runtime app/components/modules/): 0 hits (C1 α33 PASS)
 *   - features/ self-refs only remain inside features/accounting/iva-books/ tree itself
 *   - Safe to wholesale delete: all consumers repointed at C1 GREEN
 *
 * Actual files remaining pre-C2 (9 of 13 git-tracked):
 *   PRESENT (9) → 9 FAIL pre-GREEN:
 *     iva-books.types.ts, iva-books.validation.ts, iva-calc.utils.ts, server.ts, index.ts (5 src)
 *     __tests__/iva-books.validation.test.ts, __tests__/iva-calc.utils.test.ts (2 tests)
 *     __tests__/legacy-class-deletion-shape.poc-siguiente-a2.test.ts (A2 sentinel)
 *     __tests__/vi-mock-legacy-cleanup-shape.poc-siguiente-a2.test.ts (A2 sentinel)
 *   ABSENT already (3 git mv'd at C1) → 3 PASS pre-RED:
 *     exporters/excel.exporter.ts, exporters/sheet.builder.ts, __tests__/excel-exporter.test.ts
 *
 * Revised ledger (actual): 9 FAIL (Block1 file-still-exists) + 1 FAIL (Block2 dir)
 *   + 1 FAIL (Block3 grep) + 2 FAIL (Block6 A2 explicit) = 13 FAIL
 *   + 3 PASS (Block1 already-absent) + 12 PASS (Blocks 4,5,7,8 — C1 delivered) = 15 PASS
 *   = 28α total (spec target met)
 * Note: spec declared 16 FAIL / 12 PASS — delta because exporters already moved at C1 (3 fewer FAILs).
 * The 28α total is preserved as canonical.
 *
 * [[red_acceptance_failure_mode]] — FILE-STILL-EXISTS (existsSync returns true → expect(false) FAILS)
 * [[runtime_path_coverage_red_scope]] — Block 4: runtime consumers verified
 * [[enumerated_baseline_failure_ledger]] — per-test ledger α44..α71 enumerated explicit
 * [[retirement_reinventory_gate_features_inclusion]] — PRE-C2 grep WITHOUT :!features/ exclusion
 * [[cross_cycle_red_test_cementacion_gate]] — C0/C1 sentinels assert EXISTENCE at modules/ (disjoint domain)
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const IVA_BOOKS_DIR = path.resolve(
  process.cwd(),
  "features/accounting/iva-books",
);
const IVA_BOOKS_MODULE_ROOT = path.resolve(__dirname, "..");

// ─── ALL 13 FILES enumerated explicit (relative to features/accounting/iva-books/) ──
// Top-level source (5): iva-books.types.ts, iva-books.validation.ts, iva-calc.utils.ts,
//   server.ts, index.ts → 5 FAIL pre-GREEN (still present)
// exporters/ source (2): exporters/excel.exporter.ts, exporters/sheet.builder.ts
//   → 2 PASS pre-RED (git mv'd at C1 GREEN)
// __tests__/ (3): iva-books.validation.test.ts, iva-calc.utils.test.ts, excel-exporter.test.ts
//   → validation.test + iva-calc.utils.test: 2 FAIL pre-GREEN (still present)
//   → excel-exporter.test.ts: PASS pre-RED (git mv'd at C1 GREEN)
// A2 sentinels (2): legacy-class-deletion-shape + vi-mock-legacy-cleanup-shape
//   → 2 FAIL pre-GREEN (still present — retired collateral at C2 GREEN)
// Total: 9 FAIL + 4 PASS = 13 Block-1 assertions
const SOURCE_FILES: string[] = [
  // Top-level source files (5) — all still present → 5 FAIL pre-GREEN
  "iva-books.types.ts",        // still present → FAIL pre-GREEN
  "iva-books.validation.ts",   // still present → FAIL pre-GREEN
  "iva-calc.utils.ts",         // still present → FAIL pre-GREEN
  "server.ts",                 // still present → FAIL pre-GREEN
  "index.ts",                  // still present → FAIL pre-GREEN
  // exporters/ source files (2) — git mv'd at C1 → PASS pre-RED (already absent)
  "exporters/excel.exporter.ts",   // git mv'd at C1 → PASS pre-RED
  "exporters/sheet.builder.ts",    // git mv'd at C1 → PASS pre-RED
  // __tests__/ (4): 2 still present, 1 git mv'd, 2 A2 sentinels still present
  "__tests__/iva-books.validation.test.ts",     // still present → FAIL pre-GREEN
  "__tests__/iva-calc.utils.test.ts",           // still present → FAIL pre-GREEN
  "__tests__/excel-exporter.test.ts",           // git mv'd at C1 → PASS pre-RED
  // A2 sentinels — still present → FAIL pre-GREEN (retired collateral at C2)
  "__tests__/legacy-class-deletion-shape.poc-siguiente-a2.test.ts",    // FAIL pre-GREEN
  "__tests__/vi-mock-legacy-cleanup-shape.poc-siguiente-a2.test.ts",   // FAIL pre-GREEN
];

// ─── Block 1 — File existence checks (12α: α44..α55) ──────────────────────────
// FILE-STILL-EXISTS pre-GREEN for 9 remaining; 3 already absent → PASS pre-RED
// NOTE: SOURCE_FILES has 12 entries (matches α count 12 — the 13th is the dir check in Block 2)
describe("Block 1 — features/accounting/iva-books/* should NOT exist post-C2 delete", () => {
  it.each(SOURCE_FILES)(
    "features/accounting/iva-books/%s should NOT exist post-C2",
    (file) => {
      expect(existsSync(path.join(IVA_BOOKS_DIR, file))).toBe(false);
    },
  );
});

// ─── Block 2 — Directory non-existence (1α: α56) ──────────────────────────────
// FAIL pre-GREEN (directory still exists with remaining files)
// Post-GREEN: existsSync returns false (git rm -r removes tree)
describe("Block 2 — features/accounting/iva-books/ directory should NOT exist post-C2 delete", () => {
  it("α56: features/accounting/iva-books/ directory itself does NOT exist post-C2 delete", () => {
    // FILE-STILL-EXISTS pre-GREEN — directory present
    expect(existsSync(IVA_BOOKS_DIR)).toBe(false);
  });
});

// ─── Block 3 — REQ-001 FINAL: zero project-wide imports (1α: α57) ─────────────
// FAIL pre-GREEN — features/ tree self-refs still exist (file content references features/ paths)
// Post-GREEN: git rm removes all files → zero matches
// Filter: exclude test files (sentinels contain the string as string literals in assertions)
//         exclude comment-only lines (JSDoc lines mentioning the path as documentation)
describe("Block 3 — REQ-001 FINAL: zero @/features/accounting/iva-books references project-wide", () => {
  it("α57: git grep @/features/accounting/iva-books project-wide returns zero non-test import hits post-C2", () => {
    // FAIL pre-GREEN — features/ tree contains files that self-reference features/ paths
    // NOTE: openspec/archive and .md files are excluded (dead archive docs per exploration #2343)
    let output = "";
    try {
      output = execSync(
        "git grep \"@/features/accounting/iva-books\" -- . ':!*.md' ':!openspec/archive/**' 2>/dev/null || true",
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    const hits = output
      .split("\n")
      .filter((line) => line.trim() !== "")
      // Exclude test/sentinel files (string literals in assertions are expected)
      .filter((line) => !line.includes("__tests__"))
      .filter((line) => !line.includes(".test.ts"))
      .filter((line) => !line.includes(".test.tsx"))
      .filter((line) => !line.includes(".spec.ts"))
      .filter((line) => !line.includes(".spec.tsx"))
      // Exclude comment-only lines (JSDoc mentions the path as documentation, not actual import)
      .filter((line) => {
        const colonIdx = line.indexOf(":");
        const content = colonIdx >= 0 ? line.slice(colonIdx + 1) : line;
        const trimmed = content.trim();
        return (
          !trimmed.startsWith("*") &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("/*")
        );
      });
    expect(hits).toHaveLength(0);
  });
});

// ─── Block 4 — Runtime path coverage [[runtime_path_coverage_red_scope]] (2α: α58..α59) ──
// Consumers import from modules/... (NOT features/...)
// PASS pre-GREEN (C1 cutover already repointed all consumers)
describe("Block 4 — Runtime path coverage: consumers import from @/modules/iva-books (NOT features/)", () => {
  it("α58: purchases export route imports from @/modules/iva-books/presentation/server (NOT features/)", () => {
    // PASS pre-GREEN — C1 cutover delivered this
    const routePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/iva-books/purchases/export/route.ts",
    );
    const content = readFileSync(routePath, "utf-8");
    expect(content).toContain("@/modules/iva-books/presentation/server");
    expect(content).not.toContain("@/features/accounting/iva-books");
  });

  it("α59: sales export route imports from @/modules/iva-books/presentation/server (NOT features/)", () => {
    // PASS pre-GREEN — C1 cutover delivered this
    const routePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/iva-books/sales/export/route.ts",
    );
    const content = readFileSync(routePath, "utf-8");
    expect(content).toContain("@/modules/iva-books/presentation/server");
    expect(content).not.toContain("@/features/accounting/iva-books");
  });
});

// ─── Block 5 — Sibling modules clean (4α: α60..α63) ─────────────────────────
// Verify zero sibling modules/purchase, modules/sale, modules/iva-books, components/iva-books
// import from @/features/accounting/iva-books
// PASS pre-GREEN (C1 atomic cutover cleaned these at C1 GREEN)
describe("Block 5 — Sibling modules: zero imports from @/features/accounting/iva-books", () => {
  it("α60: modules/purchase/** does NOT import from @/features/accounting/iva-books", () => {
    // PASS pre-GREEN — C1 cutover repointed modules/purchase consumers
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/iva-books" -- modules/purchase/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    const hits = output.split("\n").filter((line) => line.trim() !== "");
    expect(hits).toHaveLength(0);
  });

  it("α61: modules/sale/** does NOT import from @/features/accounting/iva-books", () => {
    // PASS pre-GREEN — C1 cutover repointed modules/sale consumers
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/iva-books" -- modules/sale/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    const hits = output.split("\n").filter((line) => line.trim() !== "");
    expect(hits).toHaveLength(0);
  });

  it("α62: modules/iva-books/** does NOT import from @/features/accounting/iva-books (non-test files)", () => {
    // PASS pre-GREEN — iva-books hex module never imported from features/ (pre-existing hex)
    // Exclude test/sentinel files: sentinels contain the string as string literals in assertions
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/iva-books" -- modules/iva-books/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    const hits = output
      .split("\n")
      .filter((line) => line.trim() !== "")
      .filter((line) => !line.includes("__tests__"))
      .filter((line) => !line.includes(".test.ts"))
      .filter((line) => !line.includes(".test.tsx"));
    expect(hits).toHaveLength(0);
  });

  it("α63: components/iva-books/** does NOT import from @/features/accounting/iva-books", () => {
    // PASS pre-GREEN — C1 cutover repointed components/iva-books consumers
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/iva-books" -- components/iva-books/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    const hits = output.split("\n").filter((line) => line.trim() !== "");
    expect(hits).toHaveLength(0);
  });
});

// ─── Block 6 — A2 sentinel retirement verified (2α: α64..α65) ────────────────
// Subset of Block 1 — explicit assertions for REQ-010 traceability
// [[red_acceptance_failure_mode]]: FILE-STILL-EXISTS — A2 sentinels still present in features/ pre-GREEN
// Post-GREEN: git rm -r features/accounting/iva-books/ retires them collaterally
describe("Block 6 — A2 sentinel retirement: poc-siguiente-a2 sentinels should NOT exist post-C2", () => {
  it("α64: legacy-class-deletion-shape.poc-siguiente-a2.test.ts does NOT exist post-C2 delete", () => {
    // FILE-STILL-EXISTS pre-GREEN — A2 sentinel still in features/__tests__/
    expect(
      existsSync(
        path.join(
          IVA_BOOKS_DIR,
          "__tests__/legacy-class-deletion-shape.poc-siguiente-a2.test.ts",
        ),
      ),
    ).toBe(false);
  });

  it("α65: vi-mock-legacy-cleanup-shape.poc-siguiente-a2.test.ts does NOT exist post-C2 delete", () => {
    // FILE-STILL-EXISTS pre-GREEN — A2 sentinel still in features/__tests__/
    expect(
      existsSync(
        path.join(
          IVA_BOOKS_DIR,
          "__tests__/vi-mock-legacy-cleanup-shape.poc-siguiente-a2.test.ts",
        ),
      ),
    ).toBe(false);
  });
});

// ─── Block 7 — C0 sentinels still operational (2α: α66..α67) ─────────────────
// C0 sentinel files in modules/iva-books/__tests__/ must NOT be accidentally deleted
// PASS pre-GREEN (wholesale delete only targets features/accounting/iva-books/)
describe("Block 7 — C0 sentinels still operational (NOT accidentally deleted)", () => {
  it("α66: c0-domain-presentation-relocation-shape sentinel STILL EXISTS at modules/iva-books/__tests__/", () => {
    // PASS pre-GREEN — C2 delete targets features/ only; modules/ sentinels untouched
    expect(
      existsSync(
        path.join(
          IVA_BOOKS_MODULE_ROOT,
          "__tests__/c0-domain-presentation-relocation-shape.poc-accounting-iva-books-hex.test.ts",
        ),
      ),
    ).toBe(true);
  });

  it("α67: c0-vi-mock-targets-shape sentinel STILL EXISTS at modules/iva-books/__tests__/", () => {
    // PASS pre-GREEN — modules/ sentinels untouched by features/ wholesale delete
    expect(
      existsSync(
        path.join(
          IVA_BOOKS_MODULE_ROOT,
          "__tests__/c0-vi-mock-targets-shape.poc-accounting-iva-books-hex.test.ts",
        ),
      ),
    ).toBe(true);
  });

  it("α71: c1-cutover-shape sentinel STILL EXISTS at modules/iva-books/__tests__/", () => {
    // PASS pre-GREEN — modules/ sentinels untouched by features/ wholesale delete
    expect(
      existsSync(
        path.join(
          IVA_BOOKS_MODULE_ROOT,
          "__tests__/c1-cutover-shape.poc-accounting-iva-books-hex.test.ts",
        ),
      ),
    ).toBe(true);
  });
});

// ─── Block 8 — presentation/server.ts + domain STILL correct shape (3α: α68..α70) ──
// Post-C1 state verified: server.ts has real exportIvaBookExcel, no features/ import
// Domain compute-iva-totals.ts has numeric TASA_IVA (UNCHANGED — IVA-D2)
// PASS pre-GREEN (C1 delivered all of these)
describe("Block 8 — presentation/server.ts and domain still correct shape post-C2 delete", () => {
  it("α68: modules/iva-books/presentation/server.ts exports exportIvaBookExcel (wired C1 — still present)", () => {
    // PASS pre-GREEN — C1 GREEN wired real exportIvaBookExcel import in server.ts
    const presServerPath = path.join(
      IVA_BOOKS_MODULE_ROOT,
      "presentation/server.ts",
    );
    expect(readFileSync(presServerPath, "utf-8")).toMatch(/exportIvaBookExcel/m);
  });

  it("α69: modules/iva-books/presentation/server.ts does NOT import from @/features/accounting/iva-books", () => {
    // PASS pre-GREEN — server.ts was updated at C1 to use modules/ paths only
    const presServerPath = path.join(
      IVA_BOOKS_MODULE_ROOT,
      "presentation/server.ts",
    );
    expect(readFileSync(presServerPath, "utf-8")).not.toMatch(
      /from\s+["']@\/features\/accounting\/iva-books/m,
    );
  });

  it("α70: modules/iva-books/domain/compute-iva-totals.ts has numeric TASA_IVA (NOT Prisma.Decimal — IVA-D2 dual-constant)", () => {
    // PASS pre-GREEN — domain numeric TASA_IVA = 0.13 UNCHANGED (IVA-D2)
    const domainPath = path.join(
      IVA_BOOKS_MODULE_ROOT,
      "domain/compute-iva-totals.ts",
    );
    const content = readFileSync(domainPath, "utf-8");
    expect(content).toMatch(/TASA_IVA/m);
    expect(content).not.toMatch(/Prisma\.Decimal/m);
  });
});
