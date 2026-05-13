import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C2 RED — Infrastructure layer shape tests for POC financial-statements-hex.
 * Paired sister: modules/ai-agent/__tests__/c2-infrastructure-shape.poc-ai-agent-hex.test.ts
 *                (GREEN `8f84eb64` — legacy adapter pattern + cross-module-boundary negative).
 *
 * Strategy: readFileSync regex assertions on infrastructure files.
 * Expected failure mode: ENOENT — files absent pre-GREEN per
 * [[red_acceptance_failure_mode]]. C0+C1 54α stable (175α in scope including
 * migrated pure-function tests); this RED adds α55..α65 (11 new).
 *
 * S1 carry-forward (from C1 ledger #2274):
 * - PrismaFinancialStatementsRepo must implement ALL 7 port methods (not 4 per
 *   design §3) — actual repo surface confirmed from financial-statements.repository.ts.
 * - C2 GREEN must also rewrite service's 2 transitional exporter imports
 *   (@/features/.../exporters → ../infrastructure/exporters) atomically.
 *
 * REQ mapping:
 * - Block 1 (α55-α58): PrismaFinancialStatementsRepo exists + implements
 *   FinancialStatementsQueryPort (7 methods)
 * - Block 2 (α59-α61): LegacyAccountSubtypeLabelAdapter exists + implements
 *   AccountSubtypeLabelPort + wraps @/modules/accounting/domain (NOT features/)
 * - Block 3 (α62-α65): exporters sub-dir — pdf.exporter, excel.exporter,
 *   sheet.builder, statement-shape exist under infrastructure/exporters/
 * - REQ-004 NEGATIVE: no application/** file imports @/features/accounting/
 *   account-subtype.utils directly (adapter wraps at ONE location)
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any modules/accounting/financial-statements/
 * presentation/** path — C3 target paths excluded from C2 assertions.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const INFRASTRUCTURE = path.join(
  ROOT,
  "modules/accounting/financial-statements/infrastructure",
);
const APPLICATION = path.join(
  ROOT,
  "modules/accounting/financial-statements/application",
);

function infraFile(relative: string): string {
  return path.join(INFRASTRUCTURE, relative);
}

function readInfraFile(relative: string): string {
  const filePath = infraFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/financial-statements/infrastructure/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Walk a directory recursively and return source file contents joined.
 * Used for REQ-004 NEGATIVE cross-module-boundary grep.
 */
function walkSources(dir: string): string {
  if (!fs.existsSync(dir)) return "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const parts: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "__tests__" || e.name === "node_modules") continue;
      parts.push(walkSources(full));
    } else if (e.isFile() && /\.(ts|tsx)$/.test(e.name)) {
      parts.push(fs.readFileSync(full, "utf8"));
    }
  }
  return parts.join("\n");
}

describe("POC financial-statements-hex C2 — infrastructure layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — PrismaFinancialStatementsRepo (REQ-004)
  // Implements FinancialStatementsQueryPort with all 7 methods confirmed from
  // S1 actual surface (findFiscalPeriod, findAccountBalances, findAccountsWithSubtype,
  // aggregateJournalLinesUpTo, aggregateJournalLinesInRange, *UpToBulk, *InRangeBulk).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — PrismaFinancialStatementsRepo (REQ-004)", () => {
    it("α55: PrismaFinancialStatementsRepo class is exported from infrastructure/prisma-financial-statements.repo", () => {
      const content = readInfraFile("prisma-financial-statements.repo.ts");
      expect(content).toMatch(/export\s+class\s+PrismaFinancialStatementsRepo\b/m);
    });

    it("α56: PrismaFinancialStatementsRepo declares implements FinancialStatementsQueryPort", () => {
      const content = readInfraFile("prisma-financial-statements.repo.ts");
      expect(content).toMatch(/implements\s+FinancialStatementsQueryPort/m);
    });

    it("α57: PrismaFinancialStatementsRepo exposes the 7-method port surface", () => {
      const content = readInfraFile("prisma-financial-statements.repo.ts");
      // All 7 methods confirmed present in the source repository (S1 carry-forward).
      expect(content).toMatch(/(?:async\s+)?findFiscalPeriod\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?findAccountBalances\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?findAccountsWithSubtype\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?aggregateJournalLinesUpTo\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?aggregateJournalLinesInRange\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?aggregateJournalLinesUpToBulk\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?aggregateJournalLinesInRangeBulk\s*\(/m);
    });

    it("α58: PrismaFinancialStatementsRepo does NOT import from financial-statements application layer (R2)", () => {
      const content = readInfraFile("prisma-financial-statements.repo.ts");
      // Infrastructure must not depend on application (R2 — infra → domain only).
      expect(content).not.toMatch(
        /from\s+["'](?:\.\.\/application|@\/modules\/accounting\/financial-statements\/application)/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — LegacyAccountSubtypeLabelAdapter (REQ-004 port insulation, design §6)
  // Wraps formatSubtypeLabel from @/modules/accounting/domain/account-subtype.utils
  // (already canonical; features/accounting/account-subtype.utils is a 2-line alias).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — LegacyAccountSubtypeLabelAdapter (design §6)", () => {
    it("α59: LegacyAccountSubtypeLabelAdapter class is exported from infrastructure/legacy-account-subtype-label.adapter", () => {
      const content = readInfraFile("legacy-account-subtype-label.adapter.ts");
      expect(content).toMatch(/export\s+class\s+LegacyAccountSubtypeLabelAdapter\b/m);
    });

    it("α60: LegacyAccountSubtypeLabelAdapter declares implements AccountSubtypeLabelPort", () => {
      const content = readInfraFile("legacy-account-subtype-label.adapter.ts");
      expect(content).toMatch(/implements\s+AccountSubtypeLabelPort/m);
    });

    it("α61: LegacyAccountSubtypeLabelAdapter wraps @/modules/accounting/domain/account-subtype.utils (canonical home, NOT features/)", () => {
      const content = readInfraFile("legacy-account-subtype-label.adapter.ts");
      // Must import from canonical modules path (not the features/ alias).
      expect(content).toMatch(
        /from\s+["']@\/modules\/accounting\/domain\/account-subtype\.utils["']/m,
      );
      // NEGATIVE: must NOT import from the features/ alias (REQ-004 boundary).
      expect(content).not.toMatch(
        /from\s+["']@\/features\/accounting\/account-subtype\.utils["']/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — Exporters sub-dir under infrastructure/ (design §2, D6)
  // pdfmake + exceljs = Node-runtime infra (not domain). Lifted from
  // features/accounting/financial-statements/exporters/.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Exporters sub-dir (infrastructure/exporters/)", () => {
    it("α62: infrastructure/exporters/pdf.exporter.ts exists", () => {
      const filePath = infraFile("exporters/pdf.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/financial-statements/infrastructure/exporters/pdf.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α63: infrastructure/exporters/excel.exporter.ts exists", () => {
      const filePath = infraFile("exporters/excel.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/financial-statements/infrastructure/exporters/excel.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α64: infrastructure/exporters/sheet.builder.ts exists", () => {
      const filePath = infraFile("exporters/sheet.builder.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/financial-statements/infrastructure/exporters/sheet.builder.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α65: infrastructure/exporters/statement-shape.ts exists", () => {
      const filePath = infraFile("exporters/statement-shape.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/financial-statements/infrastructure/exporters/statement-shape.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-004 NEGATIVE: cross-module-boundary insulation
  // LegacyAccountSubtypeLabelAdapter wraps account-subtype.utils at ONE location;
  // NO application/** file should import @/features/accounting/account-subtype.utils.
  // (The application layer uses AccountSubtypeLabelPort interface, not the utils fn.)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-004 NEGATIVE: cross-module-boundary insulation", () => {
    it("α66: NO file in modules/accounting/financial-statements/application/** imports @/features/accounting/account-subtype.utils directly", () => {
      const blob = walkSources(APPLICATION);
      // The application layer must use the port interface — direct utils import
      // would bypass the adapter boundary.
      expect(blob).not.toMatch(
        /from\s+["']@\/features\/accounting\/account-subtype\.utils["']/m,
      );
    });
  });
});
