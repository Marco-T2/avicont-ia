/**
 * C5 — Wholesale Delete: features/accounting/financial-statements/ sentinel
 * poc-financial-statements-hex · OLEADA 5 3/3
 *
 * Failure mode (pre-GREEN): FILE-STILL-EXISTS
 *   existsSync(path) returns true → expect(false) FAILS
 *   NOT ENOENT on the test runner itself — sentinel resolves fine.
 *   Files exist pre-delete; will be absent post-GREEN.
 *
 * Failure mode (post-GREEN): all assertions flip to PASS (existsSync returns false).
 *
 * Paired sister: ai-agent C5 RED `e8b1565c` + GREEN `f84edceb` (54α)
 * Scope: 25 files = 13 src top-level + 5 __tests__/ + 1 exporters/__tests__/ +
 *        6 exporters/ src = 25 file existence assertions + 1 REQ-001 + 2 runtime
 *        path coverage = 28α total.
 *
 * [[red_acceptance_failure_mode]] — FILE-STILL-EXISTS (existsSync returns true), NOT ENOENT
 * [[runtime_path_coverage_red_scope]] — Block 3: runtime consumers verified
 * [[enumerated_baseline_failure_ledger]] — per-test ledger α95..α122 enumerated explicit
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const FS_DIR = path.resolve(
  process.cwd(),
  "features/accounting/financial-statements",
);

// ─── ALL 25 FILES enumerated explicit (relative to features/accounting/financial-statements/) ──
// Category breakdown:
//   Top-level source (13): balance-sheet.builder.ts, balance-source.resolver.ts,
//     date-presets.utils.ts, financial-statements.repository.ts,
//     financial-statements.service.ts, financial-statements.types.ts,
//     financial-statements.validation.ts, income-statement.builder.ts, index.ts,
//     money.utils.ts, retained-earnings.calculator.ts, server.ts,
//     statement-table-rows.utils.ts
//   exporters/ source (6): excel.exporter.ts, pdf.exporter.ts, pdf.fonts.ts,
//     pdf.helpers.ts, sheet.builder.ts, statement-shape.ts
//   __tests__/ (5): contra-account-exporters.test.ts, exporters-multicol.test.ts,
//     exporters.test.ts, financial-statements.service.test.ts,
//     sheet-builder-multicol.test.ts
//   exporters/__tests__/ (1): pdf.helpers.test.ts
// Total: 13 + 6 + 5 + 1 = 25 files

const SOURCE_FILES: string[] = [
  // Top-level source files (13)
  "balance-sheet.builder.ts",
  "balance-source.resolver.ts",
  "date-presets.utils.ts",
  "financial-statements.repository.ts",
  "financial-statements.service.ts",
  "financial-statements.types.ts",
  "financial-statements.validation.ts",
  "income-statement.builder.ts",
  "index.ts",
  "money.utils.ts",
  "retained-earnings.calculator.ts",
  "server.ts",
  "statement-table-rows.utils.ts",
  // exporters/ source files (6)
  "exporters/excel.exporter.ts",
  "exporters/pdf.exporter.ts",
  "exporters/pdf.fonts.ts",
  "exporters/pdf.helpers.ts",
  "exporters/sheet.builder.ts",
  "exporters/statement-shape.ts",
  // __tests__/ (5) — service-coupled, deferred from C4 per [[API_breaking_change_C1_blocks_C4_test_migration]]
  "__tests__/contra-account-exporters.test.ts",
  "__tests__/exporters-multicol.test.ts",
  "__tests__/exporters.test.ts",
  "__tests__/financial-statements.service.test.ts",
  "__tests__/sheet-builder-multicol.test.ts",
  // exporters/__tests__/ (1)
  "exporters/__tests__/pdf.helpers.test.ts",
];

// ─── Block 1 — File existence checks (25α) ────────────────────────────────────
// α95..α119 — FILE-STILL-EXISTS pre-GREEN; PASS post-GREEN (existsSync returns false)
describe("Block 1 — features/accounting/financial-statements/* should NOT exist post-C5 delete", () => {
  it.each(SOURCE_FILES)(
    "features/accounting/financial-statements/%s should NOT exist post-C5",
    (file) => {
      expect(existsSync(path.join(FS_DIR, file))).toBe(false);
    },
  );
});

// ─── Block 2 — REQ-001: zero production imports outside features/ (1α) ────────
// α120 — verifies no runtime consumer references @/features/accounting/financial-statements
describe("Block 2 — REQ-001: zero @/features/accounting/financial-statements imports in production", () => {
  it("α120: git grep @/features/accounting/financial-statements outside features/ returns 0 production hits", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/financial-statements" -- app/ components/ lib/ modules/ scripts/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    // Only sentinel/test assertion strings are allowed — not actual import statements
    // Filter out lines that are comments or string literals inside test assertions
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
// α121: serializeStatement consumers import from modules/.../presentation/server (NOT features/)
// α122: ai-agent prompts import formatBolivianAmount from modules/.../presentation/server (NOT features/)
describe("Block 3 — Runtime path coverage: consumers import from modules/accounting/financial-statements", () => {
  it("α121: app/api/.../balance-sheet/route.ts imports from @/modules/accounting/financial-statements/presentation (NOT features/)", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/financial-statements/balance-sheet/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain(
      "@/modules/accounting/financial-statements/presentation",
    );
    expect(content).not.toContain("@/features/accounting/financial-statements");
  });

  it("α122: modules/ai-agent/domain/prompts/balance-sheet-analysis.prompt.ts imports formatBolivianAmount from @/modules/accounting/financial-statements/presentation/server (NOT features/)", () => {
    const filePath = path.resolve(
      process.cwd(),
      "modules/ai-agent/domain/prompts/balance-sheet-analysis.prompt.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).toContain(
      "@/modules/accounting/financial-statements/presentation/server",
    );
    expect(content).not.toContain("@/features/accounting/financial-statements");
  });
});
