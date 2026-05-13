/**
 * C5 — Wholesale Delete: features/accounting/initial-balance/ sentinel
 * poc-accounting-initial-balance-hex · OLEADA 6 sub-POC 4/8
 *
 * Failure mode (pre-GREEN): FILE-STILL-EXISTS
 *   existsSync(path) returns true → expect(false) FAILS for files still present.
 *   Files already git-mv'd at C0/C2 (already absent → PASS pre-RED):
 *     initial-balance.types.ts → git mv'd at C0 GREEN
 *     initial-balance.validation.ts → git mv'd at C0 GREEN
 *     __tests__/initial-balance.types.test.ts → git mv'd at C0 GREEN
 *     __tests__/initial-balance.builder.test.ts → git mv'd at C0 GREEN
 *     exporters/__tests__/initial-balance-pdf.exporter.test.ts → git mv'd at C2 GREEN
 *     exporters/__tests__/initial-balance-xlsx.exporter.test.ts → git mv'd at C2 GREEN
 *
 * Failure mode (post-GREEN): all assertions flip to PASS (existsSync returns false).
 *
 * Paired sister (closest): poc-accounting-worksheet-hex C5 (commit bbaaf034 RED / 25e0deba GREEN, 28α)
 *
 * Scope: 14 spec files = 6 src top-level + 2 exporters/ + 4 __tests__/ +
 *        2 exporters/__tests__/ = 14 file existence assertions (α90..α103)
 *        + 1 REQ-001 (α104)
 *        + 2 runtime path coverage (α105..α106) [[runtime_path_coverage_red_scope]]
 *        + 9 sibling-features inventory (α107..α115)
 *        + 2 REQ-009 + REQ-010 FINAL (α116..α117)
 *        = 28α total.
 *
 * IB axis-distinct vs WS (closest sister):
 *   - 14 files (NOT 15 as WS): NO integration.test.ts in features/accounting/initial-balance/
 *   - 8 EXIST / 6 ABSENT pre-RED (WS had 11 EXIST / 4 ABSENT)
 *     EXIST: builder.ts, service.ts, repository.ts, server.ts,
 *            exporters/pdf, exporters/xlsx,
 *            __tests__/service.test.ts, __tests__/repository.test.ts
 *     ABSENT (already moved): types.ts (C0), validation.ts (C0),
 *            __tests__/types.test.ts (C0), __tests__/builder.test.ts (C0),
 *            exporters/__tests__/pdf.test.ts (C2), exporters/__tests__/xlsx.test.ts (C2)
 *   - Block 4 sibling inventory: 9α (FS + TB + ES + WS + dashboard + ai-agent + app grep
 *     + presentation/server barrel + directory existence check)
 *
 * PRE-C5 grep inventory result [[retirement_reinventory_gate_features_inclusion]]:
 *   - git grep @/features/accounting/initial-balance (runtime): 0 production hits
 *   - Sibling features (FS/TB/ES/WS modules): 0 imports from initial-balance features/
 *   - Closed-POC sentinels (FS/TB/ES/WS): 0 readFileSync refs to initial-balance features/
 *   - No sibling consumer cutover required (C4 fully completed cutover)
 *
 * Actual files remaining post-C0/C2 git mv (8 of 14 remain):
 *   - 6 test files already absent from features/accounting/initial-balance/:
 *       initial-balance.types.ts → git mv'd at C0 GREEN (PASS pre-RED)
 *       initial-balance.validation.ts → git mv'd at C0 GREEN (PASS pre-RED)
 *       __tests__/initial-balance.types.test.ts → git mv'd at C0 GREEN (PASS pre-RED)
 *       __tests__/initial-balance.builder.test.ts → git mv'd at C0 GREEN (PASS pre-RED)
 *       exporters/__tests__/initial-balance-pdf.exporter.test.ts → git mv'd at C2 GREEN (PASS pre-RED)
 *       exporters/__tests__/initial-balance-xlsx.exporter.test.ts → git mv'd at C2 GREEN (PASS pre-RED)
 *   - 8 FAIL (FILE-STILL-EXISTS) + 6 PASS (already absent) = 14 Block-1α pre-GREEN ledger
 *   - Blocks 2..5 (14α): some PASS pre-RED (C4 cutover complete), some FAIL
 *     Block 2 (α104): PASS pre-RED (C4 cleaned route.ts)
 *     Block 3 (α105..α106): PASS pre-RED (C4 cutover repointed consumers)
 *     Block 4 (α107..α115): PASS pre-RED (0 sibling consumers confirmed)
 *     Block 5 (α116..α117): PASS pre-RED (domain clean; pdf.exporter cross-module present)
 *   - Total pre-GREEN ledger: 8 FAIL (file-still-exists) + 20 PASS = 28α
 *
 * Behavioral loss accepted (deferred per SDD tasks):
 *   - service.test.ts (17α): ctor shape IB-D4 migration (conditional — deferred if incompatible)
 *   - repository.test.ts (11α): behavioral / real Prisma $queryRaw — deferred at C2
 *   (Both files still in features/ → deleted at C5 GREEN)
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

const IB_DIR = path.resolve(
  process.cwd(),
  "features/accounting/initial-balance",
);

// ─── ALL 14 FILES enumerated explicit (relative to features/accounting/initial-balance/) ──
// Category breakdown:
//   Top-level source (6): initial-balance.types.ts, initial-balance.service.ts,
//     initial-balance.repository.ts, initial-balance.builder.ts,
//     initial-balance.validation.ts, server.ts
//   NOTE: NO index.ts in features/accounting/initial-balance/ (server.ts only for barrel)
//   exporters/ source (2): exporters/initial-balance-pdf.exporter.ts,
//     exporters/initial-balance-xlsx.exporter.ts
//   __tests__/ (4): initial-balance.types.test.ts, initial-balance.builder.test.ts,
//     initial-balance.service.test.ts, initial-balance.repository.test.ts
//   NOTE: NO integration.test.ts (axis-distinct vs WS — IB never had one; confirmed from audit)
//   NOTE: NO validation.test.ts (axis-distinct — IB never had a dedicated validation test)
//   exporters/__tests__/ (2): exporters/__tests__/initial-balance-pdf.exporter.test.ts,
//     exporters/__tests__/initial-balance-xlsx.exporter.test.ts
// Total: 6 + 2 + 4 + 2 = 14 files
//
// Pre-RED ledger (α90..α103):
//   8 FAIL (FILE-STILL-EXISTS): builder.ts, service.ts, repository.ts, server.ts,
//     exporters/pdf, exporters/xlsx, __tests__/service.test.ts, __tests__/repository.test.ts
//   6 PASS (already absent):
//     initial-balance.types.ts → git mv'd at C0 GREEN
//     initial-balance.validation.ts → git mv'd at C0 GREEN
//     __tests__/initial-balance.types.test.ts → git mv'd at C0 GREEN
//     __tests__/initial-balance.builder.test.ts → git mv'd at C0 GREEN
//     exporters/__tests__/initial-balance-pdf.exporter.test.ts → git mv'd at C2 GREEN
//     exporters/__tests__/initial-balance-xlsx.exporter.test.ts → git mv'd at C2 GREEN

const SOURCE_FILES: string[] = [
  // Top-level source files (6) — builder/service/repository/server still present → 4 FAIL pre-RED
  // types.ts + validation.ts git mv'd at C0 → 2 PASS pre-RED
  "initial-balance.types.ts",       // git mv'd at C0 → PASS pre-RED
  "initial-balance.service.ts",     // still present → FAIL pre-RED
  "initial-balance.repository.ts",  // still present → FAIL pre-RED
  "initial-balance.builder.ts",     // still present → FAIL pre-RED
  "initial-balance.validation.ts",  // git mv'd at C0 → PASS pre-RED
  "server.ts",                      // still present → FAIL pre-RED
  // exporters/ source files (2) — still present → 2 FAIL pre-RED
  "exporters/initial-balance-pdf.exporter.ts",   // still present → FAIL pre-RED
  "exporters/initial-balance-xlsx.exporter.ts",  // still present → FAIL pre-RED
  // __tests__/ (4) — service/repository still present (2 FAIL); types/builder git mv'd (2 PASS)
  "__tests__/initial-balance.types.test.ts",      // git mv'd at C0 → PASS pre-RED
  "__tests__/initial-balance.builder.test.ts",    // git mv'd at C0 → PASS pre-RED
  "__tests__/initial-balance.service.test.ts",    // deferred (IB-D4 migration) → FAIL pre-RED
  "__tests__/initial-balance.repository.test.ts", // deferred at C2 ($queryRaw) → FAIL pre-RED
  // exporters/__tests__/ (2) — both git mv'd at C2 → PASS pre-RED
  "exporters/__tests__/initial-balance-pdf.exporter.test.ts",  // git mv'd at C2 → PASS pre-RED
  "exporters/__tests__/initial-balance-xlsx.exporter.test.ts", // git mv'd at C2 → PASS pre-RED
];

// ─── Block 1 — File existence checks (14α: α90..α103) ─────────────────────────
// FILE-STILL-EXISTS pre-GREEN for 8 remaining; 6 already absent → PASS pre-RED
describe("Block 1 — features/accounting/initial-balance/* should NOT exist post-C5 delete", () => {
  it.each(SOURCE_FILES)(
    "features/accounting/initial-balance/%s should NOT exist post-C5",
    (file) => {
      expect(existsSync(path.join(IB_DIR, file))).toBe(false);
    },
  );
});

// ─── Block 2 — REQ-001 FINAL: zero production imports (1α: α104) ──────────────
// Verifies no runtime consumer references @/features/accounting/initial-balance
// PASSES pre-GREEN (C4 already cleaned route.ts; sentinel test files excluded by filter)
describe("Block 2 — REQ-001 FINAL: zero @/features/accounting/initial-balance imports in production", () => {
  it("α104: git grep @/features/accounting/initial-balance outside test files returns 0 production hits", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/initial-balance" -- app/ components/ lib/ modules/ scripts/ 2>/dev/null || true',
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

// ─── Block 3 — Runtime path coverage [[runtime_path_coverage_red_scope]] (2α: α105..α106) ──
// Consumers import from modules/... (NOT features/...)
// PASSES pre-GREEN (C4 cutover already repointed imports)
describe("Block 3 — Runtime path coverage: consumers import from modules/accounting/initial-balance", () => {
  it("α105: app/api/.../initial-balance/route.ts imports from @/modules/accounting/initial-balance/presentation/server (NOT features/)", () => {
    const routePath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/initial-balance/route.ts",
    );
    const content = readFileSync(routePath, "utf8");
    expect(content).toContain(
      "@/modules/accounting/initial-balance/presentation/server",
    );
    expect(content).not.toContain("@/features/accounting/initial-balance");
  });

  it("α106: app/api/.../initial-balance/__tests__/route.test.ts mocks @/modules/accounting/initial-balance paths (NOT features/)", () => {
    const routeTestPath = path.resolve(
      process.cwd(),
      "app/api/organizations/[orgSlug]/initial-balance/__tests__/route.test.ts",
    );
    const content = readFileSync(routeTestPath, "utf8");
    expect(content).toContain(
      "modules/accounting/initial-balance",
    );
    expect(content).not.toContain("features/accounting/initial-balance");
  });
});

// ─── Block 4 — Sibling-features PRE-C5 inventory (9α: α107..α115) ────────────
// Verify zero sibling features/modules import from @/features/accounting/initial-balance
// Per [[retirement_reinventory_gate_features_inclusion]] — PRE-C5 grep WITHOUT :!features/ exclusion
// All PASS pre-GREEN (PRE-C5 inventory confirmed 0 sibling consumers)
describe("Block 4 — Sibling-features inventory: zero imports from @/features/accounting/initial-balance", () => {
  it("α107: modules/accounting/financial-statements/** does NOT import from @/features/accounting/initial-balance", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/initial-balance" -- modules/accounting/financial-statements/ 2>/dev/null || true',
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

  it("α108: modules/accounting/trial-balance/** does NOT import from @/features/accounting/initial-balance", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/initial-balance" -- modules/accounting/trial-balance/ 2>/dev/null || true',
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

  it("α109: modules/accounting/equity-statement/** does NOT import from @/features/accounting/initial-balance", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/initial-balance" -- modules/accounting/equity-statement/ 2>/dev/null || true',
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

  it("α110: modules/accounting/worksheet/** does NOT import from @/features/accounting/initial-balance", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/initial-balance" -- modules/accounting/worksheet/ 2>/dev/null || true',
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

  it("α111: app/(dashboard)/[orgSlug]/accounting/** does NOT import from @/features/accounting/initial-balance", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/initial-balance" -- "app/(dashboard)/" 2>/dev/null || true',
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

  it("α112: modules/ai-agent/** does NOT import from @/features/accounting/initial-balance", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/initial-balance" -- modules/ai-agent/ 2>/dev/null || true',
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

  it("α113: global app/ grep for @/features/accounting/initial-balance in runtime files returns empty", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/features/accounting/initial-balance" -- app/ 2>/dev/null || true',
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

  it("α114: modules/accounting/initial-balance/presentation/server.ts does NOT import from @/features/accounting/initial-balance (no legacy import in hex barrel)", () => {
    const presentationServerPath = path.resolve(
      process.cwd(),
      "modules/accounting/initial-balance/presentation/server.ts",
    );
    const content = readFileSync(presentationServerPath, "utf8");
    expect(content).not.toMatch(
      /from\s+["']@\/features\/accounting\/initial-balance/m,
    );
  });

  it("α115: features/accounting/initial-balance/ directory does NOT exist post-C5 delete", () => {
    expect(existsSync(IB_DIR)).toBe(false);
  });
});

// ─── Block 5 — REQ-009 + REQ-010 FINAL verification (2α: α116..α117) ─────────
// α116: domain/** zero FS cross-import (REQ-009 FINAL)
// α117: pdf exporter still imports from FS infra (REQ-010 POSITIVE — tech debt tolerated)
describe("Block 5 — REQ-009 FINAL + REQ-010 carry-forward", () => {
  it("α116: modules/accounting/initial-balance/domain/** does NOT import from @/modules/accounting/financial-statements (REQ-009 FINAL)", () => {
    let output = "";
    try {
      output = execSync(
        'git grep "@/modules/accounting/financial-statements" -- modules/accounting/initial-balance/domain/ 2>/dev/null || true',
        { cwd: process.cwd(), encoding: "utf8" },
      );
    } catch {
      output = "";
    }
    // Filter to actual import statements only — exclude JSDoc comment lines
    // Same JSDoc-in-grep false-positive pattern as WS C5 [[engram_textual_rule_verification]]
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

  it("α117: modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter.ts imports from @/modules/accounting/financial-statements/infrastructure/exporters (REQ-010 POSITIVE — tech debt tolerated, carry-forward to sub-POC 6)", () => {
    const pdfExporterPath = path.resolve(
      process.cwd(),
      "modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter.ts",
    );
    const content = readFileSync(pdfExporterPath, "utf8");
    expect(content).toMatch(
      /from\s+["']@\/modules\/accounting\/financial-statements\/infrastructure\/exporters/m,
    );
  });
});
