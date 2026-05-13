/**
 * C5 — Wholesale Delete: features/accounting/trial-balance/ sentinel
 * poc-accounting-trial-balance-hex · OLEADA 6 sub-POC 1/8
 *
 * Failure mode (pre-GREEN): FILE-STILL-EXISTS
 *   existsSync(path) returns true → expect(false) FAILS for files still present.
 *   Files already git-mv'd at C0/C2 (types.test, builder.test, pdf-exporter.test,
 *   xlsx-exporter.test) → existsSync already false → PASS pre-GREEN.
 *   NOT ENOENT on the test runner itself — sentinel resolves fine.
 *
 * Failure mode (post-GREEN): all assertions flip to PASS (existsSync returns false).
 *
 * Paired sister: poc-financial-statements-hex C5 (commit e7b4f01f RED / f1f1d1a9 GREEN, 28α)
 * Scope: 16 spec files = 7 src top-level + 2 exporters/ + 5 __tests__/ +
 *        2 exporters/__tests__/ = 16 file existence assertions
 *        + 1 REQ-001 + 2 runtime path coverage + 8 sibling-features + 1 REQ-009 = 28α.
 *
 * PRE-C5 grep inventory result [[retirement_reinventory_gate_features_inclusion]]:
 *   - git grep @/features/accounting/trial-balance (production): 0 hits ✓
 *   - Sibling features equity-statement/worksheet/initial-balance/iva-books: 0 imports ✓
 *     (equity-statement.integration.test.ts JSDoc comment only — NOT an import)
 *   - Closed-POC sentinels (FS/dispatch/ai-agent): 0 readFileSync refs to TB features/ ✓
 *   - No sibling consumer cutover required (DISTINCT from sister FS C5 which had 15 consumers)
 *
 * Actual files remaining post-C0/C2 git mv:
 *   12 files remain (4 test files already moved to modules/accounting/trial-balance/__tests__/):
 *   - types.test.ts + builder.test.ts → git mv'd at C0 GREEN (already absent → PASS pre-RED)
 *   - pdf.exporter.test.ts + xlsx.exporter.test.ts → git mv'd at C2 GREEN (already absent → PASS pre-RED)
 *   12 FAIL + 16 PASS = 28α pre-GREEN ledger.
 *
 * [[red_acceptance_failure_mode]] — FILE-STILL-EXISTS (existsSync returns true), NOT ENOENT
 * [[runtime_path_coverage_red_scope]] — Block 3: runtime consumers verified
 * [[enumerated_baseline_failure_ledger]] — per-test ledger α90..α117 enumerated explicit
 * [[retirement_reinventory_gate_features_inclusion]] — PRE-C5 grep WITHOUT :!features/ exclusion
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const TB_DIR = path.resolve(
  process.cwd(),
  "features/accounting/trial-balance",
);

// ─── ALL 16 FILES enumerated explicit (relative to features/accounting/trial-balance/) ──
// Category breakdown:
//   Top-level source (7): trial-balance.types.ts, trial-balance.service.ts,
//     trial-balance.repository.ts, trial-balance.builder.ts,
//     trial-balance.validation.ts, server.ts, index.ts
//   exporters/ source (2): exporters/trial-balance-pdf.exporter.ts,
//     exporters/trial-balance-xlsx.exporter.ts
//   __tests__/ (5): trial-balance.types.test.ts, trial-balance.builder.test.ts,
//     trial-balance.service.test.ts, trial-balance.repository.test.ts,
//     trial-balance.integration.test.ts
//   exporters/__tests__/ (2): exporters/__tests__/trial-balance-pdf.exporter.test.ts,
//     exporters/__tests__/trial-balance-xlsx.exporter.test.ts
// Total: 7 + 2 + 5 + 2 = 16 files
//
// Pre-RED ledger:
//   12 FAIL (FILE-STILL-EXISTS): 7 src + 2 exporters/ + 3 __tests__/ remaining
//   4 PASS (already absent at C5 RED):
//     __tests__/trial-balance.types.test.ts → git mv'd at C0 GREEN
//     __tests__/trial-balance.builder.test.ts → git mv'd at C0 GREEN
//     exporters/__tests__/trial-balance-pdf.exporter.test.ts → git mv'd at C2 GREEN
//     exporters/__tests__/trial-balance-xlsx.exporter.test.ts → git mv'd at C2 GREEN

const SOURCE_FILES: string[] = [
  // Top-level source files (7)
  "trial-balance.types.ts",
  "trial-balance.service.ts",
  "trial-balance.repository.ts",
  "trial-balance.builder.ts",
  "trial-balance.validation.ts",
  "server.ts",
  "index.ts",
  // exporters/ source files (2)
  "exporters/trial-balance-pdf.exporter.ts",
  "exporters/trial-balance-xlsx.exporter.ts",
  // __tests__/ (5) — service deferred per [[API_breaking_change_C1_blocks_C4_test_migration]];
  // repository.test + integration.test deferred; types.test + builder.test already git mv'd
  "__tests__/trial-balance.types.test.ts",
  "__tests__/trial-balance.builder.test.ts",
  "__tests__/trial-balance.service.test.ts",
  "__tests__/trial-balance.repository.test.ts",
  "__tests__/trial-balance.integration.test.ts",
  // exporters/__tests__/ (2) — already git mv'd at C2 GREEN (already absent)
  "exporters/__tests__/trial-balance-pdf.exporter.test.ts",
  "exporters/__tests__/trial-balance-xlsx.exporter.test.ts",
];

// ─── Block 1 — File existence checks (16α) ────────────────────────────────────
// α90..α105 — FILE-STILL-EXISTS pre-GREEN for 12 remaining; 4 already absent → PASS pre-RED
describe("Block 1 — features/accounting/trial-balance/* should NOT exist post-C5 delete", () => {
  it.each(SOURCE_FILES)(
    "features/accounting/trial-balance/%s should NOT exist post-C5",
    (file) => {
      expect(existsSync(path.join(TB_DIR, file))).toBe(false);
    },
  );
});

// ─── Block 2 — REQ-001: zero production imports (1α) ─────────────────────────
// α106 — verifies no runtime consumer references @/features/accounting/trial-balance
describe("Block 2 — REQ-001 FINAL: zero @/features/accounting/trial-balance imports in production", () => {
  it("α106: git grep @/features/accounting/trial-balance outside test files returns 0 production hits", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/trial-balance" -- app/ components/ lib/ modules/ scripts/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    const productionImportLines = output
      .split("\n")
      .filter((line) => line.trim() !== "")
      .filter((line) => !line.includes("__tests__"))
      .filter((line) => !line.includes(".test.ts"))
      .filter((line) => !line.includes(".test.tsx"))
      .filter((line) => !line.includes(".spec.ts"))
      .filter((line) => !line.includes(".spec.tsx"));

    expect(productionImportLines).toHaveLength(0);
  });
});

// ─── Block 3 — Runtime path coverage [[runtime_path_coverage_red_scope]] (2α) ──
// α107..α108 — consumers import from modules/... (NOT features/...)
// These PASS pre-GREEN (C4 cutover already repointed imports)
describe("Block 3 — Runtime path coverage: consumers import from modules/accounting/trial-balance", () => {
  it("α107: app/api/.../trial-balance/route.ts imports from @/modules/accounting/trial-balance/presentation/server (NOT features/)", () => {
    const routePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/trial-balance/route.ts",
    );
    const content = readFileSync(routePath, "utf8");
    expect(content).toContain(
      "@/modules/accounting/trial-balance/presentation/server",
    );
    expect(content).not.toContain("@/features/accounting/trial-balance");
  });

  it("α108: app/api/.../trial-balance/__tests__/route.test.ts mocks @/modules/accounting/trial-balance/presentation/server (NOT features/)", () => {
    const routeTestPath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/trial-balance/__tests__/route.test.ts",
    );
    const content = readFileSync(routeTestPath, "utf8");
    expect(content).toContain(
      "modules/accounting/trial-balance/presentation/server",
    );
    expect(content).not.toContain("features/accounting/trial-balance");
  });
});

// ─── Block 4 — Sibling-features PRE-C5 inventory (8α) ────────────────────────
// α109..α116 — verify zero sibling features import from @/features/accounting/trial-balance
// Per [[retirement_reinventory_gate_features_inclusion]] — PRE-CN grep WITHOUT :!features/ exclusion
// All expected PASS pre-GREEN (PRE-C5 inventory confirmed 0 sibling consumers)
describe("Block 4 — Sibling-features inventory: zero imports from @/features/accounting/trial-balance", () => {
  it("α109: app/api/.../equity-statement/route.ts does NOT import from @/features/accounting/trial-balance", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/equity-statement/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/trial-balance");
  });

  it("α110: app/api/.../worksheet/route.ts does NOT import from @/features/accounting/trial-balance", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/worksheet/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/trial-balance");
  });

  it("α111: app/api/.../initial-balance/route.ts does NOT import from @/features/accounting/trial-balance", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/initial-balance/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/trial-balance");
  });

  it("α112: modules/accounting/financial-statements/** does NOT import from @/features/accounting/trial-balance", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/trial-balance" -- modules/accounting/financial-statements/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    const hits = output
      .split("\n")
      .filter((line) => line.trim() !== "");
    expect(hits).toHaveLength(0);
  });

  it("α113: app/(dashboard)/[orgSlug]/accounting/trial-balance/__tests__/page.test.ts does NOT import from @/features/accounting/trial-balance", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/(dashboard)/[orgSlug]/accounting/trial-balance/__tests__/page.test.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/trial-balance");
  });

  it("α114: modules/ai-agent/** does NOT import from @/features/accounting/trial-balance", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/trial-balance" -- modules/ai-agent/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    const hits = output
      .split("\n")
      .filter((line) => line.trim() !== "");
    expect(hits).toHaveLength(0);
  });

  it("α115: global app/ grep for @/features/accounting/trial-balance returns empty", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/trial-balance" -- app/ 2>/dev/null || true',
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

  it("α116: modules/accounting/trial-balance/presentation/server.ts does NOT import from @/features/accounting/trial-balance", () => {
    const presentationServerPath = path.resolve(
      process.cwd(),
      "modules/accounting/trial-balance/presentation/server.ts",
    );
    const content = readFileSync(presentationServerPath, "utf8");
    expect(content).not.toMatch(
      /from\s+["']@\/features\/accounting\/trial-balance/m,
    );
  });
});

// ─── Block 5 — REQ-009 FINAL: zero FS cross-import in trial-balance domain (1α) ──
// α117 — domain files must NOT import from @/modules/accounting/financial-statements
// Expected PASS pre-GREEN (locked at C0 GREEN, sentinel maintained through C1..C4)
// NOTE: filter to actual import lines only — JSDoc comments in trial-balance.builder.ts
// (line 6) contain the literal path for documentation purposes. This is the same
// JSDoc-in-grep false-positive pattern documented at C3 [[engram_textual_rule_verification]].
// We match only lines that contain an actual `from` import, excluding comment-only lines.
describe("Block 5 — REQ-009 FINAL: modules/accounting/trial-balance/domain/** zero FS cross-import", () => {
  it("α117: domain/** does NOT import from @/modules/accounting/financial-statements", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/modules/accounting/financial-statements" -- modules/accounting/trial-balance/domain/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    // Filter to actual import statements only — exclude JSDoc comment lines
    // (grep result format: "filename:line_content" — filter out lines where content starts with * or //)
    const actualImportHits = output
      .split("\n")
      .filter((line) => line.trim() !== "")
      .filter((line) => {
        // Extract content after "filename:" prefix
        const colonIdx = line.indexOf(":");
        const content = colonIdx >= 0 ? line.slice(colonIdx + 1) : line;
        const trimmed = content.trim();
        // Exclude JSDoc comment lines and inline comments
        return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
      })
      .filter((line) => /from\s+["']/.test(line)); // must be an actual import statement
    expect(actualImportHits).toHaveLength(0);
  });
});
