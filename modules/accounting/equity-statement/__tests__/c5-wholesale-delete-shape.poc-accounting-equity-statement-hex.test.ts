/**
 * C5 — Wholesale Delete: features/accounting/equity-statement/ sentinel
 * poc-accounting-equity-statement-hex · OLEADA 6 sub-POC 2/8
 *
 * Failure mode (pre-GREEN): FILE-STILL-EXISTS
 *   existsSync(path) returns true → expect(false) FAILS for files still present.
 *   Files already git-mv'd at C0/C2 (types.test, builder.test, validation.test,
 *   pdf-exporter.test, xlsx-exporter.test, repository.test) →
 *   existsSync already false → CONDITIONAL-PASS pre-GREEN.
 *   NOT ENOENT on the test runner itself — sentinel resolves fine.
 *
 * Failure mode (post-GREEN): all assertions flip to PASS (existsSync returns false).
 *
 * Paired sister: poc-accounting-trial-balance-hex C5 (commit 90f4b82f RED / 12f85a44 GREEN, 28α)
 * Scope: 17 spec files = 7 src top-level + 2 exporters/ + 6 __tests__/ +
 *        2 exporters/__tests__/ = 17 file existence assertions
 *        + 1 REQ-001 + 2 runtime path coverage + 7 sibling-features + 1 REQ-009 FINAL = 28α.
 *
 * PRE-C5 grep inventory result [[retirement_reinventory_gate_features_inclusion]]:
 *   - git grep @/features/accounting/equity-statement (external): 0 production hits ✓
 *     (only c4-cutover-shape sentinel references literal path in JSDoc/test strings — NOT imports)
 *   - Sibling features initial-balance/iva-books/worksheet/exporters: 0 imports ✓
 *   - Closed-POC sentinels (FS/TB/dispatch/ai-agent): 0 readFileSync refs to ES features/ ✓
 *   - No sibling consumer cutover required (DISTINCT from sister FS C5 which had 15 consumers)
 *
 * Actual files remaining post-C0/C2 git mv:
 *   11 files remain (6 test files already moved to modules/accounting/equity-statement/__tests__/):
 *   - types.test.ts → git mv'd at C0 GREEN (already absent → CONDITIONAL-PASS pre-RED)
 *   - builder.test.ts → git mv'd at C0 GREEN (already absent → CONDITIONAL-PASS pre-RED)
 *   - validation.test.ts → git mv'd at C0 GREEN (already absent → CONDITIONAL-PASS pre-RED)
 *   - repository.test.ts → git mv'd at C2 GREEN (already absent → CONDITIONAL-PASS pre-RED)
 *   - pdf.exporter.test.ts → git mv'd at C2 GREEN (already absent → CONDITIONAL-PASS pre-RED)
 *   - xlsx.exporter.test.ts → git mv'd at C2 GREEN (already absent → CONDITIONAL-PASS pre-RED)
 *   11 FAIL (FILE-STILL-EXISTS) + 6 CONDITIONAL-PASS (already absent) = 17 Block-1α pre-GREEN ledger.
 *   Plus 11α (Blocks 2..5) = 11 FAIL pre-GREEN.
 *   Total pre-GREEN ledger: 11 FAIL + 6 CONDITIONAL-PASS (Block 1) + 11 FAIL (Blocks 2..5) = 22 FAIL + 6 CONDITIONAL-PASS.
 *
 * [[red_acceptance_failure_mode]] — FILE-STILL-EXISTS (existsSync returns true → expect(false) FAILS)
 * [[runtime_path_coverage_red_scope]] — Block 3: runtime consumers verified
 * [[enumerated_baseline_failure_ledger]] — per-test ledger α94..α121 enumerated explicit
 * [[retirement_reinventory_gate_features_inclusion]] — PRE-C5 grep WITHOUT :!features/ exclusion
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ES_DIR = path.resolve(
  process.cwd(),
  "features/accounting/equity-statement",
);

// ─── ALL 17 FILES enumerated explicit (relative to features/accounting/equity-statement/) ──
// Category breakdown:
//   Top-level source (7): equity-statement.types.ts, equity-statement.service.ts,
//     equity-statement.repository.ts, equity-statement.builder.ts,
//     equity-statement.validation.ts, server.ts, index.ts
//   exporters/ source (2): exporters/equity-statement-pdf.exporter.ts,
//     exporters/equity-statement-xlsx.exporter.ts
//   __tests__/ (6): equity-statement.types.test.ts, equity-statement.builder.test.ts,
//     equity-statement.service.test.ts, equity-statement.repository.test.ts,
//     equity-statement.integration.test.ts, equity-statement.validation.test.ts
//   exporters/__tests__/ (2): exporters/__tests__/equity-statement-pdf.exporter.test.ts,
//     exporters/__tests__/equity-statement-xlsx.exporter.test.ts
// Total: 7 + 2 + 6 + 2 = 17 files
//
// Pre-RED ledger:
//   11 FAIL (FILE-STILL-EXISTS): 7 src + 2 exporters/ + 2 __tests__/ remaining (service + integration)
//   6 CONDITIONAL-PASS (already absent):
//     __tests__/equity-statement.types.test.ts → git mv'd at C0 GREEN
//     __tests__/equity-statement.builder.test.ts → git mv'd at C0 GREEN
//     __tests__/equity-statement.validation.test.ts → git mv'd at C0 GREEN
//     __tests__/equity-statement.repository.test.ts → git mv'd at C2 GREEN
//     exporters/__tests__/equity-statement-pdf.exporter.test.ts → git mv'd at C2 GREEN
//     exporters/__tests__/equity-statement-xlsx.exporter.test.ts → git mv'd at C2 GREEN

const SOURCE_FILES: string[] = [
  // Top-level source files (7)
  "equity-statement.types.ts",
  "equity-statement.service.ts",
  "equity-statement.repository.ts",
  "equity-statement.builder.ts",
  "equity-statement.validation.ts",
  "server.ts",
  "index.ts",
  // exporters/ source files (2)
  "exporters/equity-statement-pdf.exporter.ts",
  "exporters/equity-statement-xlsx.exporter.ts",
  // __tests__/ (6) — service.test deferred per [[API_breaking_change_C1_blocks_C4_test_migration]];
  // integration.test deferred (5α behavioral loss accepted per D8);
  // types.test + builder.test + validation.test already git mv'd at C0;
  // repository.test already git mv'd at C2
  "__tests__/equity-statement.types.test.ts",
  "__tests__/equity-statement.builder.test.ts",
  "__tests__/equity-statement.service.test.ts",
  "__tests__/equity-statement.repository.test.ts",
  "__tests__/equity-statement.integration.test.ts",
  "__tests__/equity-statement.validation.test.ts",
  // exporters/__tests__/ (2) — already git mv'd at C2 GREEN (already absent)
  "exporters/__tests__/equity-statement-pdf.exporter.test.ts",
  "exporters/__tests__/equity-statement-xlsx.exporter.test.ts",
];

// ─── Block 1 — File existence checks (17α) ────────────────────────────────────
// α94..α110 — FILE-STILL-EXISTS pre-GREEN for 11 remaining; 6 already absent → CONDITIONAL-PASS pre-RED
describe("Block 1 — features/accounting/equity-statement/* should NOT exist post-C5 delete", () => {
  it.each(SOURCE_FILES)(
    "features/accounting/equity-statement/%s should NOT exist post-C5",
    (file) => {
      expect(existsSync(path.join(ES_DIR, file))).toBe(false);
    },
  );
});

// ─── Block 2 — REQ-001 FINAL: zero production imports (1α) ────────────────────
// α111 — verifies no runtime consumer references @/features/accounting/equity-statement
describe("Block 2 — REQ-001 FINAL: zero @/features/accounting/equity-statement imports in production", () => {
  it("α111: git grep @/features/accounting/equity-statement outside test files returns 0 production hits", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/equity-statement" -- app/ components/ lib/ modules/ scripts/ 2>/dev/null || true',
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
// α112..α113 — consumers import from modules/... (NOT features/...)
// These PASS pre-GREEN (C4 cutover already repointed imports)
describe("Block 3 — Runtime path coverage: consumers import from modules/accounting/equity-statement", () => {
  it("α112: app/api/.../equity-statement/route.ts imports from modules/accounting/equity-statement/presentation/server (NOT features/)", () => {
    const routePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/equity-statement/route.ts",
    );
    const content = readFileSync(routePath, "utf8");
    expect(content).toContain(
      "@/modules/accounting/equity-statement/presentation/server",
    );
    expect(content).not.toContain("@/features/accounting/equity-statement");
  });

  it("α113: app/api/.../equity-statement/__tests__/route.test.ts mocks modules/accounting/equity-statement/presentation/server (NOT features/)", () => {
    const routeTestPath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/equity-statement/__tests__/route.test.ts",
    );
    const content = readFileSync(routeTestPath, "utf8");
    expect(content).toContain(
      "modules/accounting/equity-statement/presentation/server",
    );
    expect(content).not.toContain("features/accounting/equity-statement");
  });
});

// ─── Block 4 — Sibling-features PRE-C5 inventory (7α) ────────────────────────
// α114..α120 — verify zero sibling features import from @/features/accounting/equity-statement
// Per [[retirement_reinventory_gate_features_inclusion]] — PRE-C5 grep WITHOUT :!features/ exclusion
// All expected PASS pre-GREEN (PRE-C5 inventory confirmed 0 sibling consumers)
describe("Block 4 — Sibling-features inventory: zero imports from @/features/accounting/equity-statement", () => {
  it("α114: app/api/.../trial-balance/route.ts does NOT import from @/features/accounting/equity-statement", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/trial-balance/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/equity-statement");
  });

  it("α115: app/api/.../worksheet/route.ts does NOT import from @/features/accounting/equity-statement", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/worksheet/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/equity-statement");
  });

  it("α116: app/api/.../initial-balance/route.ts does NOT import from @/features/accounting/equity-statement", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/initial-balance/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/equity-statement");
  });

  it("α117: modules/accounting/financial-statements/** does NOT import from @/features/accounting/equity-statement", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/equity-statement" -- modules/accounting/financial-statements/ 2>/dev/null || true',
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

  it("α118: modules/accounting/trial-balance/** does NOT import from @/features/accounting/equity-statement", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/equity-statement" -- modules/accounting/trial-balance/ 2>/dev/null || true',
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

  it("α119: app/(dashboard)/[orgSlug]/accounting/equity-statement/__tests__/page.test.ts (if exists) does NOT import from @/features/accounting/equity-statement", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/(dashboard)/[orgSlug]/accounting/equity-statement/__tests__/page.test.ts",
    );
    if (!existsSync(filePath)) {
      // File absent — trivially satisfies constraint
      expect(true).toBe(true);
      return;
    }
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/equity-statement");
  });

  it("α120: modules/accounting/equity-statement/presentation/server.ts does NOT import from @/features/accounting/equity-statement", () => {
    const presentationServerPath = path.resolve(
      process.cwd(),
      "modules/accounting/equity-statement/presentation/server.ts",
    );
    const content = readFileSync(presentationServerPath, "utf8");
    expect(content).not.toMatch(
      /from\s+["']@\/features\/accounting\/equity-statement/m,
    );
  });
});

// ─── Block 5 — REQ-009 FINAL: zero FS cross-import in equity-statement domain (1α) ──
// α121 — domain files must NOT import from @/modules/accounting/financial-statements
// Expected PASS pre-GREEN (locked at C0 GREEN, sentinel maintained through C1..C4)
// NOTE: filter to actual import lines only — JSDoc comments may contain the path for documentation.
// Same JSDoc-in-grep false-positive pattern as TB C5 [[engram_textual_rule_verification]].
describe("Block 5 — REQ-009 FINAL: modules/accounting/equity-statement/domain/** zero FS cross-import", () => {
  it("α121: domain/** does NOT import from @/modules/accounting/financial-statements", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/modules/accounting/financial-statements" -- modules/accounting/equity-statement/domain/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    // Filter to actual import statements only — exclude JSDoc comment lines
    const actualImportHits = output
      .split("\n")
      .filter((line) => line.trim() !== "")
      .filter((line) => {
        const colonIdx = line.indexOf(":");
        const content = colonIdx >= 0 ? line.slice(colonIdx + 1) : line;
        const trimmed = content.trim();
        return !trimmed.startsWith("*") && !trimmed.startsWith("//") && !trimmed.startsWith("/*");
      })
      .filter((line) => /from\s+["']/.test(line));
    expect(actualImportHits).toHaveLength(0);
  });
});
