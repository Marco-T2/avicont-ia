import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C2 RED — Infrastructure layer shape tests for poc-accounting-equity-statement-hex.
 * Paired sister: modules/accounting/trial-balance/__tests__/c2-infrastructure-shape.poc-accounting-trial-balance-hex.test.ts
 *                (RED `96acb983` — PrismaRepo + exporters exist + cross-module-boundary POSITIVE).
 *
 * Strategy: readFileSync / existsSync assertions on infrastructure files.
 * Expected failure mode: ENOENT — files absent pre-GREEN per [[red_acceptance_failure_mode]].
 *   - α40..α52: ENOENT (positive assertions, files absent) → 13 FAIL / 0 PASS pre-GREEN
 * C0+C1 39α stable; this RED adds α40..α52 (13 new).
 *
 * REQ mapping (4 blocks / 13α):
 * - Block 1 (α40..α43): PrismaEquityStatementRepo class + implements EquityStatementQueryPort +
 *   6-method port surface + R2 NEGATIVE (no application import from infra)
 * - Block 2 (α44..α47): PrismaIncomeStatementSourceAdapter class + implements IncomeStatementSourcePort +
 *   2-method delegation surface (findAccountsWithSubtype + aggregateJournalLinesInRange) [AXIS-DISTINCT — NEW]
 * - Block 3 (α48..α51): exporters sub-dir — equity-statement-pdf + equity-statement-xlsx exist +
 *   exportEquityStatementPdf/exportEquityStatementXlsx exported
 * - Block 4 (α52): REQ-010 sentinel — pdf exporter imports pdf.fonts/pdf.helpers from
 *   @/modules/accounting/shared/infrastructure/exporters (RESOLVED — shared canonical home)
 *
 * REQ-010 cross-module INFRA dep (RESOLVED — sub-POC 6 poc-accounting-exporters-cleanup):
 * pdf.fonts.ts + pdf.helpers.ts git-mv'd from FS-infra to the shared canonical home.
 * α52 now asserts @/modules/accounting/shared/infrastructure/exporters/.
 * FAIL: any @/modules/accounting/financial-statements/* import in infra
 *
 * REQ-012 NEW (AXIS-DISTINCT vs TB): PrismaIncomeStatementSourceAdapter must exist, implement
 * IncomeStatementSourcePort, and delegate the 2 canonical methods to PrismaFinancialStatementsRepo.
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any modules/accounting/equity-statement/presentation/** paths
 * (C3 target paths excluded from C2 assertions — verified).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const INFRA = path.join(ROOT, "modules/accounting/equity-statement/infrastructure");

function infraFile(relative: string): string {
  return path.join(INFRA, relative);
}

function readInfraFile(relative: string): string {
  const filePath = infraFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/equity-statement/infrastructure/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC accounting-equity-statement-hex C2 — infrastructure layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — PrismaEquityStatementRepo (REQ-004)
  // Class rename: EquityStatementRepository → PrismaEquityStatementRepo.
  // Implements EquityStatementQueryPort with 6 methods (AXIS-DISTINCT vs TB 3-method).
  // Methods: getPatrimonioBalancesAt, getTypedPatrimonyMovements, getAperturaPatrimonyDelta,
  //          findPatrimonioAccounts, getOrgMetadata, isClosedPeriodMatch
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — PrismaEquityStatementRepo (REQ-004) — 6-method port", () => {
    it("α40: PrismaEquityStatementRepo class is exported from infrastructure/prisma-equity-statement.repo", () => {
      const content = readInfraFile("prisma-equity-statement.repo.ts");
      expect(content).toMatch(/export\s+class\s+PrismaEquityStatementRepo\b/m);
    });

    it("α41: PrismaEquityStatementRepo declares implements EquityStatementQueryPort", () => {
      const content = readInfraFile("prisma-equity-statement.repo.ts");
      expect(content).toMatch(/implements\s+EquityStatementQueryPort/m);
    });

    it("α42: PrismaEquityStatementRepo exposes all 6 query methods", () => {
      const content = readInfraFile("prisma-equity-statement.repo.ts");
      expect(content).toMatch(/(?:async\s+)?getPatrimonioBalancesAt\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?getTypedPatrimonyMovements\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?getAperturaPatrimonyDelta\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?findPatrimonioAccounts\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?getOrgMetadata\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?isClosedPeriodMatch\s*\(/m);
    });

    it("α43: PrismaEquityStatementRepo does NOT import from equity-statement application layer (R2)", () => {
      const content = readInfraFile("prisma-equity-statement.repo.ts");
      expect(content).not.toMatch(
        /from\s+["'](?:\.\.\/application|@\/modules\/accounting\/equity-statement\/application)/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — PrismaIncomeStatementSourceAdapter (NEW — AXIS-DISTINCT, REQ-012)
  // Thin delegation wrapper implementing IncomeStatementSourcePort.
  // Delegates findAccountsWithSubtype + aggregateJournalLinesInRange to
  // PrismaFinancialStatementsRepo (REQ-4 canonical FS source — D9 Option A).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — PrismaIncomeStatementSourceAdapter (REQ-012 — AXIS-DISTINCT)", () => {
    it("α44: PrismaIncomeStatementSourceAdapter class is exported from infrastructure/prisma-income-statement-source.adapter", () => {
      const content = readInfraFile("prisma-income-statement-source.adapter.ts");
      expect(content).toMatch(/export\s+class\s+PrismaIncomeStatementSourceAdapter\b/m);
    });

    it("α45: PrismaIncomeStatementSourceAdapter declares implements IncomeStatementSourcePort", () => {
      const content = readInfraFile("prisma-income-statement-source.adapter.ts");
      expect(content).toMatch(/implements\s+IncomeStatementSourcePort/m);
    });

    it("α46: PrismaIncomeStatementSourceAdapter delegates findAccountsWithSubtype to PrismaFinancialStatementsRepo", () => {
      const content = readInfraFile("prisma-income-statement-source.adapter.ts");
      expect(content).toMatch(/findAccountsWithSubtype/m);
    });

    it("α47: PrismaIncomeStatementSourceAdapter delegates aggregateJournalLinesInRange to PrismaFinancialStatementsRepo", () => {
      const content = readInfraFile("prisma-income-statement-source.adapter.ts");
      expect(content).toMatch(/aggregateJournalLinesInRange/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — Exporters sub-dir (REQ-004, REQ-010, D6)
  // Both exporters under infrastructure/exporters/.
  // xlsx is self-contained (exceljs + own types + own builder). pdf has REQ-010 cross-module dep (α52).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Exporters sub-dir (REQ-004, REQ-010)", () => {
    it("α48: infrastructure/exporters/equity-statement-pdf.exporter.ts exists", () => {
      const filePath = infraFile("exporters/equity-statement-pdf.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/equity-statement/infrastructure/exporters/equity-statement-pdf.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α49: infrastructure/exporters/equity-statement-xlsx.exporter.ts exists", () => {
      const filePath = infraFile("exporters/equity-statement-xlsx.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/equity-statement/infrastructure/exporters/equity-statement-xlsx.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α50: exportEquityStatementPdf is exported from infrastructure/exporters/equity-statement-pdf.exporter", () => {
      const content = readInfraFile("exporters/equity-statement-pdf.exporter.ts");
      expect(content).toMatch(/export.*exportEquityStatementPdf/m);
    });

    it("α51: exportEquityStatementXlsx is exported from infrastructure/exporters/equity-statement-xlsx.exporter", () => {
      const content = readInfraFile("exporters/equity-statement-xlsx.exporter.ts");
      expect(content).toMatch(/export.*exportEquityStatementXlsx/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-010 RESOLVED: pdf helpers live at the shared canonical home
  // equity-statement-pdf.exporter imports registerFonts + pdfmakeRuntime (pdf.fonts) and
  // fmtDecimal (pdf.helpers) from @/modules/accounting/shared/infrastructure/exporters/.
  // git-mv'd from FS-infra at poc-accounting-exporters-cleanup (sub-POC 6) — REQ-010
  // tech debt RESOLVED; the cross-module FS dep no longer exists.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-010 RESOLVED: shared canonical infra import", () => {
    it("α52: equity-statement-pdf.exporter imports from @/modules/accounting/shared/infrastructure/exporters (REQ-010 RESOLVED — shared canonical home, poc-accounting-exporters-cleanup sub-POC 6)", () => {
      const content = readInfraFile("exporters/equity-statement-pdf.exporter.ts");
      expect(content).toMatch(
        /from\s+["']@\/modules\/accounting\/shared\/infrastructure\/exporters/m,
      );
    });
  });
});
