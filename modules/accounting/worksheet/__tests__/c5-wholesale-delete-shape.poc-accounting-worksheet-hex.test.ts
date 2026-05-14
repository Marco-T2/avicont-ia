/**
 * C5 — Wholesale Delete: features/accounting/worksheet/ sentinel
 * poc-accounting-worksheet-hex · OLEADA 6 sub-POC 3/8
 *
 * Failure mode (pre-GREEN): FILE-STILL-EXISTS
 *   existsSync(path) returns true → expect(false) FAILS for files still present.
 *   Files already git-mv'd at C0/C2:
 *     __tests__/worksheet.types.test.ts → git mv'd at C0 GREEN (already absent → PASS pre-RED)
 *     __tests__/worksheet.builder.test.ts → git mv'd at C0 GREEN (already absent → PASS pre-RED)
 *     exporters/__tests__/worksheet-pdf.exporter.test.ts → git mv'd at C2 GREEN (already absent → PASS pre-RED)
 *     exporters/__tests__/worksheet-xlsx.exporter.test.ts → git mv'd at C2 GREEN (already absent → PASS pre-RED)
 *
 * Failure mode (post-GREEN): all assertions flip to PASS (existsSync returns false).
 *
 * Paired sister (closer): poc-accounting-trial-balance-hex C5 (commit 90f4b82f RED / 12f85a44 GREEN, 28α)
 * Paired sister (contrast): poc-accounting-equity-statement-hex C5 (commit 3b57a9d8 RED / 68de447d GREEN, 28α)
 *
 * Scope: 15 spec files = 6 src top-level + 2 exporters/ + 5 __tests__/ +
 *        2 exporters/__tests__/ = 15 file existence assertions (α90..α104)
 *        + 1 REQ-001 (α105)
 *        + 2 runtime path coverage (α106..α107) [[runtime_path_coverage_red_scope]]
 *        + 8 sibling-features inventory (α108..α115)
 *        + 2 REQ-009 + REQ-010 FINAL (α116..α117)
 *        = 28α total.
 *
 * WS axis-distinct vs TB/ES:
 *   - 15 files (NOT 16 as TB, NOT 17 as ES): NO worksheet.validation.test.ts in features/
 *   - NO index.ts in features/ top-level (server.ts only for barrel)
 *   - 6 top-level src files (TB had 7: included index.ts; WS features/ had no index.ts)
 *
 * PRE-C5 grep inventory result [[retirement_reinventory_gate_features_inclusion]]:
 *   - git grep @/features/accounting/worksheet (external): 0 production hits
 *     (only c2/c4 sentinel test descriptions contain path literal — NOT import assertions)
 *   - Sibling features (equity-statement/initial-balance/iva-books/TB/FS modules): 0 imports
 *   - Closed-POC sentinels (FS/TB/ES): 0 readFileSync refs to worksheet features/
 *   - No sibling consumer cutover required (C4 fully completed cutover)
 *
 * Actual files remaining post-C0/C2 git mv (11 of 15 remain):
 *   - 4 test files already moved to modules/accounting/worksheet/__tests__/:
 *       __tests__/worksheet.types.test.ts → git mv'd at C0 GREEN (PASS pre-RED)
 *       __tests__/worksheet.builder.test.ts → git mv'd at C0 GREEN (PASS pre-RED)
 *       exporters/__tests__/worksheet-pdf.exporter.test.ts → git mv'd at C2 GREEN (PASS pre-RED)
 *       exporters/__tests__/worksheet-xlsx.exporter.test.ts → git mv'd at C2 GREEN (PASS pre-RED)
 *   - 11 FAIL (FILE-STILL-EXISTS) + 4 PASS (already absent) = 15 Block-1α pre-GREEN ledger
 *   - Blocks 2..5 (13α): 13 FAIL pre-GREEN
 *   - Total pre-GREEN ledger: 24 FAIL + 4 PASS = 28α
 *
 * Behavioral loss accepted (deferred per SDD tasks):
 *   - service.test.ts (14α): ctor shape incompatible [[API_breaking_change_C1_blocks_C4_test_migration]]
 *   - repository.test.ts (15α): behavioral / real Prisma $queryRaw — deferred at C2
 *   - integration.test.ts: deleted with features/ (behavioral loss accepted per design §8)
 *
 * [[red_acceptance_failure_mode]] — FILE-STILL-EXISTS (existsSync returns true → expect(false) FAILS)
 * [[runtime_path_coverage_red_scope]] — Block 3: runtime consumers verified
 * [[enumerated_baseline_failure_ledger]] — per-test ledger α90..α117 enumerated explicit
 * [[retirement_reinventory_gate_features_inclusion]] — PRE-C5 grep WITHOUT :!features/ exclusion
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const WS_DIR = path.resolve(
  process.cwd(),
  "features/accounting/worksheet",
);

// ─── ALL 15 FILES enumerated explicit (relative to features/accounting/worksheet/) ──
// Category breakdown:
//   Top-level source (6): worksheet.types.ts, worksheet.service.ts,
//     worksheet.repository.ts, worksheet.builder.ts,
//     worksheet.validation.ts, server.ts
//   NOTE: NO index.ts in features/accounting/worksheet/ (axis-distinct — WS had server.ts only)
//   exporters/ source (2): exporters/worksheet-pdf.exporter.ts,
//     exporters/worksheet-xlsx.exporter.ts
//   __tests__/ (5): worksheet.types.test.ts, worksheet.builder.test.ts,
//     worksheet.service.test.ts, worksheet.repository.test.ts,
//     worksheet.integration.test.ts
//   NOTE: NO worksheet.validation.test.ts (axis-distinct vs ES which had 17)
//   exporters/__tests__/ (2): exporters/__tests__/worksheet-pdf.exporter.test.ts,
//     exporters/__tests__/worksheet-xlsx.exporter.test.ts
// Total: 6 + 2 + 5 + 2 = 15 files
//
// Pre-RED ledger (α90..α104):
//   11 FAIL (FILE-STILL-EXISTS): 6 src + 2 exporters/ + 3 __tests__/ remaining
//     (service.test.ts + repository.test.ts + integration.test.ts still in features/)
//   4 PASS (already absent):
//     __tests__/worksheet.types.test.ts → git mv'd at C0 GREEN
//     __tests__/worksheet.builder.test.ts → git mv'd at C0 GREEN
//     exporters/__tests__/worksheet-pdf.exporter.test.ts → git mv'd at C2 GREEN
//     exporters/__tests__/worksheet-xlsx.exporter.test.ts → git mv'd at C2 GREEN

const SOURCE_FILES: string[] = [
  // Top-level source files (6) — all still present → 6 FAIL pre-RED
  "worksheet.types.ts",
  "worksheet.service.ts",
  "worksheet.repository.ts",
  "worksheet.builder.ts",
  "worksheet.validation.ts",
  "server.ts",
  // exporters/ source files (2) — still present → 2 FAIL pre-RED
  "exporters/worksheet-pdf.exporter.ts",
  "exporters/worksheet-xlsx.exporter.ts",
  // __tests__/ (5) — service/repo/integration still present (3 FAIL); types/builder git mv'd (2 PASS)
  "__tests__/worksheet.types.test.ts",      // git mv'd at C0 → PASS pre-RED
  "__tests__/worksheet.builder.test.ts",    // git mv'd at C0 → PASS pre-RED
  "__tests__/worksheet.service.test.ts",    // deferred [[API_breaking_change_C1_blocks_C4_test_migration]] → FAIL pre-RED
  "__tests__/worksheet.repository.test.ts", // deferred at C2 → FAIL pre-RED
  "__tests__/worksheet.integration.test.ts",// behavioral loss accepted → FAIL pre-RED
  // exporters/__tests__/ (2) — both git mv'd at C2 → PASS pre-RED
  "exporters/__tests__/worksheet-pdf.exporter.test.ts",   // git mv'd at C2 → PASS pre-RED
  "exporters/__tests__/worksheet-xlsx.exporter.test.ts",  // git mv'd at C2 → PASS pre-RED
];

// ─── Block 1 — File existence checks (15α: α90..α104) ─────────────────────────
// FILE-STILL-EXISTS pre-GREEN for 11 remaining; 4 already absent → PASS pre-RED
describe("Block 1 — features/accounting/worksheet/* should NOT exist post-C5 delete", () => {
  it.each(SOURCE_FILES)(
    "features/accounting/worksheet/%s should NOT exist post-C5",
    (file) => {
      expect(existsSync(path.join(WS_DIR, file))).toBe(false);
    },
  );
});

// ─── Block 2 — REQ-001 FINAL: zero production imports (1α: α105) ──────────────
// Verifies no runtime consumer references @/features/accounting/worksheet
// FAILS pre-GREEN (c2/c4 sentinels in modules/ have path literals in test description strings —
// but we filter to non-test files, so those are excluded; 0 FAIL expected pre-RED actually)
// Wait — the c2/c4 sentinels ARE in modules/ and contain path strings in test descriptions.
// Filter: we exclude __tests__ and .test.ts files → only runtime files checked.
// Sentinel files are in __tests__/ → excluded → productionImportLines = 0 → PASS pre-GREEN.
// Actually this sentinel FAILS pre-RED because... no, c2/c4 sentinels contain test description
// strings NOT import statements — they are in __tests__/ which are filtered out.
// Therefore α105 PASSES pre-RED (c4 already cleaned route.ts).
describe("Block 2 — REQ-001 FINAL: zero @/features/accounting/worksheet imports in production", () => {
  it("α105: git grep @/features/accounting/worksheet outside test files returns 0 production hits", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/worksheet" -- app/ components/ lib/ modules/ scripts/ 2>/dev/null || true',
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

// ─── Block 3 — Runtime path coverage [[runtime_path_coverage_red_scope]] (2α: α106..α107) ──
// Consumers import from modules/... (NOT features/...)
// These PASS pre-GREEN (C4 cutover already repointed imports)
describe("Block 3 — Runtime path coverage: consumers import from modules/accounting/worksheet", () => {
  it("α106: app/api/.../worksheet/route.ts imports from @/modules/accounting/worksheet/presentation/server (NOT features/)", () => {
    const routePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/worksheet/route.ts",
    );
    const content = readFileSync(routePath, "utf8");
    expect(content).toContain(
      "@/modules/accounting/worksheet/presentation/server",
    );
    expect(content).not.toContain("@/features/accounting/worksheet");
  });

  it("α107: app/api/.../worksheet/__tests__/route.test.ts mocks @/modules/accounting/worksheet/presentation/server (NOT features/)", () => {
    const routeTestPath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/worksheet/__tests__/route.test.ts",
    );
    const content = readFileSync(routeTestPath, "utf8");
    expect(content).toContain(
      "modules/accounting/worksheet/presentation/server",
    );
    expect(content).not.toContain("features/accounting/worksheet");
  });
});

// ─── Block 4 — Sibling-features PRE-C5 inventory (8α: α108..α115) ────────────
// Verify zero sibling features import from @/features/accounting/worksheet
// Per [[retirement_reinventory_gate_features_inclusion]] — PRE-C5 grep WITHOUT :!features/ exclusion
// All expected PASS pre-GREEN (PRE-C5 inventory confirmed 0 sibling consumers)
describe("Block 4 — Sibling-features inventory: zero imports from @/features/accounting/worksheet", () => {
  it("α108: modules/accounting/financial-statements/** does NOT import from @/features/accounting/worksheet", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/worksheet" -- modules/accounting/financial-statements/ 2>/dev/null || true',
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

  it("α109: modules/accounting/trial-balance/** does NOT import from @/features/accounting/worksheet", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/worksheet" -- modules/accounting/trial-balance/ 2>/dev/null || true',
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

  it("α110: modules/accounting/equity-statement/** does NOT import from @/features/accounting/worksheet", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/worksheet" -- modules/accounting/equity-statement/ 2>/dev/null || true',
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

  it("α111: app/api/.../equity-statement/route.ts does NOT import from @/features/accounting/worksheet", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/equity-statement/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/worksheet");
  });

  it("α112: app/api/.../trial-balance/route.ts does NOT import from @/features/accounting/worksheet", () => {
    const filePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/trial-balance/route.ts",
    );
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("features/accounting/worksheet");
  });

  it("α113: modules/ai-agent/** does NOT import from @/features/accounting/worksheet", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/worksheet" -- modules/ai-agent/ 2>/dev/null || true',
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

  it("α114: global app/ grep for @/features/accounting/worksheet in runtime files returns empty", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/worksheet" -- app/ 2>/dev/null || true',
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

  it("α115: modules/accounting/worksheet/presentation/server.ts does NOT import from @/features/accounting/worksheet (no legacy import in hex barrel)", () => {
    const presentationServerPath = path.resolve(
      process.cwd(),
      "modules/accounting/worksheet/presentation/server.ts",
    );
    const content = readFileSync(presentationServerPath, "utf8");
    expect(content).not.toMatch(
      /from\s+["']@\/features\/accounting\/worksheet/m,
    );
  });
});

// ─── Block 5 — REQ-009 + REQ-010 FINAL verification (2α: α116..α117) ─────────
// α116: domain/** zero FS cross-import (REQ-009 FINAL)
// α117: pdf exporter imports from the shared canonical home (REQ-010 RESOLVED —
//       pdf.fonts/pdf.helpers git-mv'd from FS-infra at sub-POC 6)
describe("Block 5 — REQ-009 FINAL + REQ-010 RESOLVED", () => {
  it("α116: modules/accounting/worksheet/domain/** does NOT import from @/modules/accounting/financial-statements (REQ-009 FINAL)", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/modules/accounting/financial-statements" -- modules/accounting/worksheet/domain/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    // Filter to actual import statements only — exclude JSDoc comment lines
    // Same JSDoc-in-grep false-positive pattern as TB C5 [[engram_textual_rule_verification]]
    const actualImportHits = output
      .split("\n")
      .filter((line) => line.trim() !== "")
      .filter((line) => {
        const colonIdx = line.indexOf(":");
        const content = colonIdx >= 0 ? line.slice(colonIdx + 1) : line;
        const trimmed = content.trim();
        return (
          !trimmed.startsWith("*") &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("/*")
        );
      })
      .filter((line) => /from\s+["']/.test(line));
    expect(actualImportHits).toHaveLength(0);
  });

  it("α117: modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter.ts imports from @/modules/accounting/shared/infrastructure/exporters (REQ-010 RESOLVED — shared canonical home, poc-accounting-exporters-cleanup sub-POC 6)", () => {
    const pdfExporterPath = path.resolve(
      process.cwd(),
      "modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter.ts",
    );
    const content = readFileSync(pdfExporterPath, "utf8");
    expect(content).toMatch(
      /from\s+["']@\/modules\/accounting\/shared\/infrastructure\/exporters/m,
    );
  });
});
