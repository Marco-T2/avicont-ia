import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C2 RED — Infrastructure layer shape tests for POC accounting-trial-balance-hex.
 * Paired sister: modules/accounting/financial-statements/__tests__/c2-infrastructure-shape.poc-financial-statements-hex.test.ts
 *                (RED `d01ea335` — PrismaRepo + exporters exist + cross-module-boundary NEGATIVE).
 *
 * Strategy: readFileSync / existsSync assertions on infrastructure files.
 * Expected failure mode: ENOENT — files absent pre-GREEN per [[red_acceptance_failure_mode]].
 *   - α38..α46: ENOENT (positive assertions, files absent) → 9 FAIL
 *   - α47..α48: CONDITIONAL-PASS pre-GREEN (NEGATIVE regex on absent files → trivially pass)
 * C0+C1 37α stable; this RED adds α38..α48 (11 new).
 *
 * REQ mapping (4 blocks / 11α):
 * - Block 1 (α38..α41): PrismaTrialBalanceRepo class + implements TrialBalanceQueryPort +
 *   3-method port surface + R2 NEGATIVE (no application import from infra)
 * - Block 2 (α42..α45): exporters sub-dir — trial-balance-pdf + trial-balance-xlsx exist +
 *   exportTrialBalancePdf/exportTrialBalanceXlsx exported
 * - Block 3 (α46): REQ-010 POSITIVE sentinel — pdf exporter imports from
 *   @/modules/accounting/financial-statements/infrastructure/exporters (PERMITTED cross-module infra)
 * - Block 4 (α47..α48): REQ-004 NEGATIVE — no legacy @/features/ import in infra files
 *
 * REQ-010 cross-module INFRA dep (D7 Option A):
 * ALLOW: imports from @/modules/accounting/financial-statements/infrastructure/exporters/
 * FAIL: any other @/modules/accounting/financial-statements/* import here
 * FAIL: @/modules/accounting/financial-statements/* in xlsx exporter, repo, or domain
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any modules/accounting/trial-balance/presentation/** paths
 * (C3 target paths excluded from C2 assertions — verified).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const INFRASTRUCTURE = path.join(
  ROOT,
  "modules/accounting/trial-balance/infrastructure",
);

function infraFile(relative: string): string {
  return path.join(INFRASTRUCTURE, relative);
}

function readInfraFile(relative: string): string {
  const filePath = infraFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/trial-balance/infrastructure/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC accounting-trial-balance-hex C2 — infrastructure layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — PrismaTrialBalanceRepo (REQ-004)
  // Class rename: TrialBalanceRepository → PrismaTrialBalanceRepo.
  // Implements TrialBalanceQueryPort with 3 methods confirmed from repository.ts
  // (aggregateAllVouchers, findAccounts, getOrgMetadata).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — PrismaTrialBalanceRepo (REQ-004)", () => {
    it("α38: PrismaTrialBalanceRepo class is exported from infrastructure/prisma-trial-balance.repo", () => {
      const content = readInfraFile("prisma-trial-balance.repo.ts");
      expect(content).toMatch(/export\s+class\s+PrismaTrialBalanceRepo\b/m);
    });

    it("α39: PrismaTrialBalanceRepo declares implements TrialBalanceQueryPort", () => {
      const content = readInfraFile("prisma-trial-balance.repo.ts");
      expect(content).toMatch(/implements\s+TrialBalanceQueryPort/m);
    });

    it("α40: PrismaTrialBalanceRepo exposes the 3-method port surface", () => {
      const content = readInfraFile("prisma-trial-balance.repo.ts");
      expect(content).toMatch(/(?:async\s+)?aggregateAllVouchers\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?findAccounts\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?getOrgMetadata\s*\(/m);
    });

    it("α41: PrismaTrialBalanceRepo does NOT import from trial-balance application layer (R2)", () => {
      const content = readInfraFile("prisma-trial-balance.repo.ts");
      expect(content).not.toMatch(
        /from\s+["'](?:\.\.\/application|@\/modules\/accounting\/trial-balance\/application)/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Exporters sub-dir (REQ-004, REQ-010)
  // Both exporters under infrastructure/exporters/.
  // xlsx is self-contained (exceljs only). pdf has REQ-010 cross-module-INFRA dep (α46).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Exporters sub-dir (REQ-004, REQ-010)", () => {
    it("α42: infrastructure/exporters/trial-balance-pdf.exporter.ts exists", () => {
      const filePath = infraFile("exporters/trial-balance-pdf.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/trial-balance/infrastructure/exporters/trial-balance-pdf.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α43: infrastructure/exporters/trial-balance-xlsx.exporter.ts exists", () => {
      const filePath = infraFile("exporters/trial-balance-xlsx.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/trial-balance/infrastructure/exporters/trial-balance-xlsx.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α44: exportTrialBalancePdf is exported from infrastructure/exporters/trial-balance-pdf.exporter", () => {
      const content = readInfraFile("exporters/trial-balance-pdf.exporter.ts");
      expect(content).toMatch(/export.*exportTrialBalancePdf/m);
    });

    it("α45: exportTrialBalanceXlsx is exported from infrastructure/exporters/trial-balance-xlsx.exporter", () => {
      const content = readInfraFile("exporters/trial-balance-xlsx.exporter.ts");
      expect(content).toMatch(/export.*exportTrialBalanceXlsx/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — REQ-010 POSITIVE: cross-module infra import PERMITTED (sub-POC-specific)
  // trial-balance-pdf.exporter imports registerFonts + pdfmakeRuntime (pdf.fonts) and
  // fmtDecimal (pdf.helpers) from FS infrastructure/exporters/. D7 Option A locked —
  // TECH DEBT deferred to poc-accounting-exporters-cleanup (sub-POC 6).
  // NEGATIVE: xlsx exporter must NOT have FS cross-import (self-contained).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — REQ-010 POSITIVE cross-module infra import (D7 Option A)", () => {
    it("α46: trial-balance-pdf.exporter imports from @/modules/accounting/financial-statements/infrastructure/exporters (PERMITTED per REQ-010 D7 Option A)", () => {
      const content = readInfraFile("exporters/trial-balance-pdf.exporter.ts");
      expect(content).toMatch(
        /from\s+["']@\/modules\/accounting\/financial-statements\/infrastructure\/exporters/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-004 NEGATIVE: no legacy @/features/ import in infra files
  // Post-migration: all type imports must use domain/ paths, not features/ paths.
  // α47..α48 are CONDITIONAL-PASS pre-GREEN (files absent → regex can't match).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-004 NEGATIVE: no legacy features/ import in infra", () => {
    const LEGACY_IMPORT_RE = /from\s+["']@\/features\/accounting\/trial-balance/m;

    it("α47: prisma-trial-balance.repo does NOT import from @/features/accounting/trial-balance (no legacy import after migration)", () => {
      const content = readInfraFile("prisma-trial-balance.repo.ts");
      expect(content).not.toMatch(LEGACY_IMPORT_RE);
    });

    it("α48: trial-balance-pdf.exporter does NOT import from @/features/accounting/trial-balance (no legacy import after migration)", () => {
      const content = readInfraFile("exporters/trial-balance-pdf.exporter.ts");
      expect(content).not.toMatch(LEGACY_IMPORT_RE);
    });
  });
});
