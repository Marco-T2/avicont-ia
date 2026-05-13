import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C2 RED — Infrastructure layer shape tests for POC accounting-worksheet-hex.
 * Paired sister: modules/accounting/trial-balance/__tests__/c2-infrastructure-shape.poc-accounting-trial-balance-hex.test.ts
 *                (RED `96acb983` — PrismaRepo + exporters exist + cross-module-boundary POSITIVE).
 *
 * Strategy: readFileSync / existsSync assertions on infrastructure files.
 * Expected failure mode: ENOENT — files absent pre-GREEN per [[red_acceptance_failure_mode]].
 *   - α38..α46: ENOENT (positive assertions, files absent) → 9 FAIL
 *   - α47..α48: CONDITIONAL-PASS pre-GREEN (NEGATIVE regex on absent files → trivially pass
 *     because readInfraFile throws ENOENT before regex runs — all 11 FAIL pre-GREEN)
 * C0+C1 37α stable; this RED adds α38..α48 (11 new).
 *
 * REQ mapping (4 blocks / 11α):
 * - Block 1 (α38..α41): PrismaWorksheetRepo class + implements WorksheetQueryPort +
 *   3-method port surface (findFiscalPeriod, aggregateByAdjustmentFlag, findAccountsWithDetail)
 *   + R2 NEGATIVE (no application import from infra)
 * - Block 2 (α42..α45): exporters sub-dir — worksheet-pdf.exporter + worksheet-xlsx.exporter
 *   exist + exportWorksheetPdf/exportWorksheetXlsx exported
 * - Block 3 (α46): REQ-010 POSITIVE sentinel — pdf exporter imports from
 *   @/modules/accounting/financial-statements/infrastructure/exporters (PERMITTED cross-module infra)
 * - Block 4 (α47..α48): REQ-004 NEGATIVE — no legacy @/features/ import in infra files
 *
 * REQ-010 cross-module INFRA dep (D7 Option A):
 * ALLOW: imports from @/modules/accounting/financial-statements/infrastructure/exporters/
 * FAIL: any other @/modules/accounting/financial-statements/* import here
 * FAIL: @/modules/accounting/financial-statements/* in xlsx exporter, repo, or domain
 *
 * WS-D1 axis-distinct: PrismaWorksheetRepo imports WorksheetMovementAggregation +
 * WorksheetAccountMetadata from domain/types.ts (NOT self-defined in repo per WS-D1).
 * Narrowed findFiscalPeriod return: { startDate, endDate } | null (not full FiscalPeriodRow).
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any modules/accounting/worksheet/presentation/** paths
 * (C3 target paths excluded from C2 assertions — verified).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const INFRASTRUCTURE = path.join(
  ROOT,
  "modules/accounting/worksheet/infrastructure",
);

function infraFile(relative: string): string {
  return path.join(INFRASTRUCTURE, relative);
}

function readInfraFile(relative: string): string {
  const filePath = infraFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/worksheet/infrastructure/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC accounting-worksheet-hex C2 — infrastructure layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — PrismaWorksheetRepo (REQ-004)
  // Class rename: WorksheetRepository → PrismaWorksheetRepo.
  // Implements WorksheetQueryPort with 3 methods confirmed from repository.ts
  // (findFiscalPeriod, aggregateByAdjustmentFlag, findAccountsWithDetail).
  // WS-D1: types imported from domain/types.ts, not self-defined.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — PrismaWorksheetRepo (REQ-004)", () => {
    it("α38: PrismaWorksheetRepo class is exported from infrastructure/prisma-worksheet.repo", () => {
      const content = readInfraFile("prisma-worksheet.repo.ts");
      expect(content).toMatch(/export\s+class\s+PrismaWorksheetRepo\b/m);
    });

    it("α39: PrismaWorksheetRepo declares implements WorksheetQueryPort", () => {
      const content = readInfraFile("prisma-worksheet.repo.ts");
      expect(content).toMatch(/implements\s+WorksheetQueryPort/m);
    });

    it("α40: PrismaWorksheetRepo exposes the 3-method port surface", () => {
      const content = readInfraFile("prisma-worksheet.repo.ts");
      expect(content).toMatch(/(?:async\s+)?findFiscalPeriod\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?aggregateByAdjustmentFlag\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?findAccountsWithDetail\s*\(/m);
    });

    it("α41: PrismaWorksheetRepo does NOT import from worksheet application layer (R2)", () => {
      const content = readInfraFile("prisma-worksheet.repo.ts");
      expect(content).not.toMatch(
        /from\s+["'](?:\.\.\/application|@\/modules\/accounting\/worksheet\/application)/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Exporters sub-dir (REQ-004, REQ-010)
  // Both exporters under infrastructure/exporters/.
  // xlsx is self-contained (exceljs only). pdf has REQ-010 cross-module-INFRA dep (α46).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Exporters sub-dir (REQ-004, REQ-010)", () => {
    it("α42: infrastructure/exporters/worksheet-pdf.exporter.ts exists", () => {
      const filePath = infraFile("exporters/worksheet-pdf.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/worksheet/infrastructure/exporters/worksheet-pdf.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α43: infrastructure/exporters/worksheet-xlsx.exporter.ts exists", () => {
      const filePath = infraFile("exporters/worksheet-xlsx.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/worksheet/infrastructure/exporters/worksheet-xlsx.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α44: exportWorksheetPdf is exported from infrastructure/exporters/worksheet-pdf.exporter", () => {
      const content = readInfraFile("exporters/worksheet-pdf.exporter.ts");
      expect(content).toMatch(/export.*exportWorksheetPdf/m);
    });

    it("α45: exportWorksheetXlsx is exported from infrastructure/exporters/worksheet-xlsx.exporter", () => {
      const content = readInfraFile("exporters/worksheet-xlsx.exporter.ts");
      expect(content).toMatch(/export.*exportWorksheetXlsx/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — REQ-010 POSITIVE: cross-module infra import PERMITTED (sub-POC-specific)
  // worksheet-pdf.exporter imports registerFonts + pdfmakeRuntime (pdf.fonts) and
  // fmtDecimal (pdf.helpers) from FS infrastructure/exporters/. D7 Option A locked —
  // TECH DEBT deferred to poc-accounting-exporters-cleanup (sub-POC 6).
  // NEGATIVE: xlsx exporter must NOT have FS cross-import (self-contained).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — REQ-010 POSITIVE cross-module infra import (D7 Option A)", () => {
    it("α46: worksheet-pdf.exporter imports from @/modules/accounting/financial-statements/infrastructure/exporters (PERMITTED per REQ-010 D7 Option A)", () => {
      const content = readInfraFile("exporters/worksheet-pdf.exporter.ts");
      expect(content).toMatch(
        /from\s+["']@\/modules\/accounting\/financial-statements\/infrastructure\/exporters/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-004 NEGATIVE: no legacy @/features/ import in infra files
  // Post-migration: all type imports must use domain/ paths, not features/ paths.
  // α47..α48 are CONDITIONAL-PASS pre-GREEN (files absent → readInfraFile throws
  // ENOENT before regex runs — all 11 FAIL pre-GREEN per [[red_acceptance_failure_mode]]).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-004 NEGATIVE: no legacy features/ import in infra", () => {
    const LEGACY_IMPORT_RE = /from\s+["']@\/features\/accounting\/worksheet/m;

    it("α47: prisma-worksheet.repo does NOT import from @/features/accounting/worksheet (no legacy import after migration)", () => {
      const content = readInfraFile("prisma-worksheet.repo.ts");
      expect(content).not.toMatch(LEGACY_IMPORT_RE);
    });

    it("α48: worksheet-pdf.exporter does NOT import from @/features/accounting/worksheet (no legacy import after migration)", () => {
      const content = readInfraFile("exporters/worksheet-pdf.exporter.ts");
      expect(content).not.toMatch(LEGACY_IMPORT_RE);
    });
  });
});
