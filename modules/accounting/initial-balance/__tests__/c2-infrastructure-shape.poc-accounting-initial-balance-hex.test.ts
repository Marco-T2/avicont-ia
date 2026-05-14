import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C2 RED — Infrastructure layer shape tests for POC accounting-initial-balance-hex.
 * Paired sister: modules/accounting/worksheet/__tests__/c2-infrastructure-shape.poc-accounting-worksheet-hex.test.ts
 *                (RED `cf6d31bd` — PrismaRepo + exporters exist + cross-module-boundary POSITIVE).
 *
 * Strategy: readFileSync / existsSync assertions on infrastructure files.
 * Expected failure mode: ENOENT — files absent pre-GREEN per [[red_acceptance_failure_mode]].
 *   - α36..α44: ENOENT (positive assertions, files absent) → FAIL
 *   - α45..α48: CONDITIONAL-PASS pre-GREEN (NEGATIVE regex on absent files → readInfraFile
 *     throws ENOENT before regex runs — all 13 FAIL pre-GREEN)
 * C0+C1 35α stable; this RED adds α36..α48 (13 new).
 *
 * REQ mapping (5 blocks / 13α):
 * - Block 1 (α36..α39): PrismaInitialBalanceRepo class + implements InitialBalanceQueryPort +
 *   4-method port surface (getInitialBalanceFromCA, getOrgMetadata, countCAVouchers, getCADate)
 *   + R2 NEGATIVE (no application import from infra). 4-method per IB-D2.
 * - Block 2 (α40..α43): exporters sub-dir — initial-balance-pdf.exporter +
 *   initial-balance-xlsx.exporter exist + exportInitialBalancePdf/exportInitialBalanceXlsx exported
 * - Block 3 (α44): REQ-010 sentinel — pdf exporter imports pdf.fonts/pdf.helpers from
 *   @/modules/accounting/shared/infrastructure/exporters (RESOLVED — shared canonical home)
 * - Block 4 (α45..α46): REQ-004 NEGATIVE — no legacy @/features/accounting/initial-balance
 *   import in repo or pdf exporter
 * - Block 5 (α47..α48): xlsx clean check — NEGATIVE: xlsx exporter does NOT import from
 *   FS infrastructure (self-contained, axis-distinct from WS)
 *
 * IB axis-distinct vs WS:
 *   - 4-method port (IB-D2) vs WS 3-method: α38 covers all 4 in one it() block.
 *   - Block 5 (xlsx NEGATIVE) is IB-specific: xlsx is confirmed self-contained.
 *   - IB-D1: PrismaInitialBalanceRepo imports types directly from domain/initial-balance.types.ts
 *     (no extraction needed; RawInitialBalanceRow + RawCACountRow are infra-private — stay in repo).
 *
 * REQ-010 cross-module INFRA dep (RESOLVED — sub-POC 6 poc-accounting-exporters-cleanup):
 * pdf.fonts.ts + pdf.helpers.ts git-mv'd from FS-infra to the shared canonical home.
 * α44 now asserts @/modules/accounting/shared/infrastructure/exporters/.
 * FAIL: any @/modules/accounting/financial-statements/* in xlsx exporter, repo, or domain
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any modules/accounting/initial-balance/presentation/** paths
 * (C3 target paths excluded from C2 assertions — verified).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const INFRASTRUCTURE = path.join(
  ROOT,
  "modules/accounting/initial-balance/infrastructure",
);

function infraFile(relative: string): string {
  return path.join(INFRASTRUCTURE, relative);
}

function readInfraFile(relative: string): string {
  const filePath = infraFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/initial-balance/infrastructure/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC accounting-initial-balance-hex C2 — infrastructure layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — PrismaInitialBalanceRepo (REQ-004, IB-D2)
  // Class rename: InitialBalanceRepository → PrismaInitialBalanceRepo.
  // Implements InitialBalanceQueryPort with 4 methods (IB-D2 wider than WS 3-method):
  //   getInitialBalanceFromCA, getOrgMetadata, countCAVouchers, getCADate.
  // IB-D1: RawInitialBalanceRow + RawCACountRow remain infra-private (NOT extracted to domain).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — PrismaInitialBalanceRepo (REQ-004, IB-D2)", () => {
    it("α36: PrismaInitialBalanceRepo class is exported from infrastructure/prisma-initial-balance.repo", () => {
      const content = readInfraFile("prisma-initial-balance.repo.ts");
      expect(content).toMatch(/export\s+class\s+PrismaInitialBalanceRepo\b/m);
    });

    it("α37: PrismaInitialBalanceRepo declares implements InitialBalanceQueryPort", () => {
      const content = readInfraFile("prisma-initial-balance.repo.ts");
      expect(content).toMatch(/implements\s+InitialBalanceQueryPort/m);
    });

    it("α38: PrismaInitialBalanceRepo exposes all 4 port methods (IB-D2 — wider than WS 3-method)", () => {
      const content = readInfraFile("prisma-initial-balance.repo.ts");
      expect(content).toMatch(/(?:async\s+)?getInitialBalanceFromCA\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?getOrgMetadata\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?countCAVouchers\s*\(/m);
      expect(content).toMatch(/(?:async\s+)?getCADate\s*\(/m);
    });

    it("α39: PrismaInitialBalanceRepo does NOT import from initial-balance application layer (R2)", () => {
      const content = readInfraFile("prisma-initial-balance.repo.ts");
      expect(content).not.toMatch(
        /from\s+["'](?:\.\.\/application|@\/modules\/accounting\/initial-balance\/application)/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Exporters sub-dir (REQ-004, REQ-010)
  // Both exporters under infrastructure/exporters/.
  // xlsx is self-contained (exceljs + own domain types). pdf has REQ-010 cross-module-INFRA dep (α44).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Exporters sub-dir (REQ-004, REQ-010)", () => {
    it("α40: infrastructure/exporters/initial-balance-pdf.exporter.ts exists", () => {
      const filePath = infraFile("exporters/initial-balance-pdf.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/initial-balance/infrastructure/exporters/initial-balance-pdf.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α41: infrastructure/exporters/initial-balance-xlsx.exporter.ts exists", () => {
      const filePath = infraFile("exporters/initial-balance-xlsx.exporter.ts");
      if (!fs.existsSync(filePath)) {
        throw new Error(
          "ENOENT: cannot find '@/modules/accounting/initial-balance/infrastructure/exporters/initial-balance-xlsx.exporter.ts'",
        );
      }
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("α42: exportInitialBalancePdf is exported from infrastructure/exporters/initial-balance-pdf.exporter", () => {
      const content = readInfraFile("exporters/initial-balance-pdf.exporter.ts");
      expect(content).toMatch(/export.*exportInitialBalancePdf/m);
    });

    it("α43: exportInitialBalanceXlsx is exported from infrastructure/exporters/initial-balance-xlsx.exporter", () => {
      const content = readInfraFile("exporters/initial-balance-xlsx.exporter.ts");
      expect(content).toMatch(/export.*exportInitialBalanceXlsx/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — REQ-010 RESOLVED: pdf helpers live at the shared canonical home
  // initial-balance-pdf.exporter imports registerFonts + pdfmakeRuntime (pdf.fonts) and
  // fmtDecimal (pdf.helpers) from @/modules/accounting/shared/infrastructure/exporters/.
  // git-mv'd from FS-infra at poc-accounting-exporters-cleanup (sub-POC 6) — REQ-010
  // tech debt RESOLVED; the cross-module FS dep no longer exists.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — REQ-010 RESOLVED: shared canonical infra import", () => {
    it("α44: initial-balance-pdf.exporter imports from @/modules/accounting/shared/infrastructure/exporters (REQ-010 RESOLVED — shared canonical home, poc-accounting-exporters-cleanup sub-POC 6)", () => {
      const content = readInfraFile("exporters/initial-balance-pdf.exporter.ts");
      expect(content).toMatch(
        /from\s+["']@\/modules\/accounting\/shared\/infrastructure\/exporters/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-004 NEGATIVE: no legacy @/features/ import in infra files
  // Post-migration: all type imports must use domain/ paths, not features/ paths.
  // α45..α46 CONDITIONAL-PASS pre-GREEN (files absent → ENOENT before regex runs).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-004 NEGATIVE: no legacy features/ import in infra", () => {
    const LEGACY_IMPORT_RE = /from\s+["']@\/features\/accounting\/initial-balance/m;

    it("α45: prisma-initial-balance.repo does NOT import from @/features/accounting/initial-balance (no legacy import after migration)", () => {
      const content = readInfraFile("prisma-initial-balance.repo.ts");
      expect(content).not.toMatch(LEGACY_IMPORT_RE);
    });

    it("α46: initial-balance-pdf.exporter does NOT import from @/features/accounting/initial-balance (no legacy import after migration)", () => {
      const content = readInfraFile("exporters/initial-balance-pdf.exporter.ts");
      expect(content).not.toMatch(LEGACY_IMPORT_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 5 — xlsx clean check (REQ-003 — self-contained, no FS cross-module dep)
  // IB axis-distinct: xlsx exporter has ZERO FS infrastructure cross-import.
  // Both α47 + α48 CONDITIONAL-PASS pre-GREEN (file absent → ENOENT).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 5 — xlsx clean check (REQ-003 — self-contained xlsx exporter)", () => {
    it("α47: initial-balance-xlsx.exporter does NOT import from @/modules/accounting/financial-statements/infrastructure (self-contained — axis-distinct from pdf)", () => {
      const content = readInfraFile("exporters/initial-balance-xlsx.exporter.ts");
      expect(content).not.toMatch(
        /from\s+["']@\/modules\/accounting\/financial-statements\/infrastructure/m,
      );
    });

    it("α48: initial-balance-xlsx.exporter does NOT import from @/features/accounting/initial-balance (no legacy import)", () => {
      const content = readInfraFile("exporters/initial-balance-xlsx.exporter.ts");
      expect(content).not.toMatch(
        /from\s+["']@\/features\/accounting\/initial-balance/m,
      );
    });
  });
});
