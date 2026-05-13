import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C1 RED — Application layer shape tests for POC financial-statements-hex.
 * Paired sister: modules/ai-agent/__tests__/c1-application-shape.poc-ai-agent-hex.test.ts
 *                (GREEN `7d6e9ac8` — deps-object ctor + port injection pattern).
 *
 * Strategy: readFileSync regex assertions on application/financial-statements.service.ts
 * (the file does NOT exist pre-GREEN → ENOENT failure mode per
 * [[red_acceptance_failure_mode]]). C0 42α stable; this RED adds α43..α54 (12 new).
 *
 * REQ mapping:
 * - Block 1 (α43-α46): deps-object ctor + port injection (FinancialStatementsQueryPort
 *   + AccountSubtypeLabelPort)
 * - Block 2 (α47-α49): service surface — generateBalanceSheet / generateIncomeStatement
 *   + Buffer-returning exporter methods exist
 * - Block 3 (α50-α52): REQ-005 money math preservation (service consumes money.utils
 *   from domain; no direct Prisma.Decimal RUNTIME in application layer)
 * - Block 4 (α53-α54): REQ-006 — service does NOT runtime-import @prisma/client,
 *   does NOT import from infrastructure layer
 *
 * Note: this sentinel does NOT reference any modules/accounting/financial-statements/
 * infrastructure/** path — C2 target paths are excluded from C1 assertions per
 * [[cross_cycle_red_test_cementacion_gate]].
 */

const ROOT = path.resolve(__dirname, "../../../..");
const APPLICATION = path.join(ROOT, "modules/accounting/financial-statements/application");

function applicationFile(relative: string): string {
  return path.join(APPLICATION, relative);
}

function readApplicationFile(relative: string): string {
  const filePath = applicationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/financial-statements/application/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC financial-statements-hex C1 — application layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — deps-object ctor + port injection (REQ-002/004)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — deps-object ctor + port injection", () => {
    it("α43: FinancialStatementsService class is exported from application/financial-statements.service", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).toMatch(/export\s+class\s+FinancialStatementsService/m);
    });

    it("α44: FinancialStatementsService ctor accepts a deps object (no zero-arg form)", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      // ctor must accept a deps-shape parameter, either destructured
      // `constructor({ repo, subtypeLabel })` or typed-named
      // `constructor(deps: FinancialStatementsServiceDeps)`. Both forms are
      // accepted; the OLD optional-arg form `constructor(repo?: ...)` is banned
      // (would have a `?:` inside the ctor signature).
      expect(content).toMatch(/constructor\s*\(\s*(?:\{|\w+\s*:\s*FinancialStatementsServiceDeps)/m);
      // Forbid the legacy optional-repo zero-arg form.
      expect(content).not.toMatch(/constructor\s*\(\s*repo\?\s*:/m);
    });

    it("α45: FinancialStatementsService consumes FinancialStatementsQueryPort via deps", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).toMatch(/FinancialStatementsQueryPort/m);
    });

    it("α46: FinancialStatementsService consumes AccountSubtypeLabelPort via deps", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).toMatch(/AccountSubtypeLabelPort/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Service surface
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Service surface", () => {
    it("α47: generateBalanceSheet method is declared on FinancialStatementsService", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).toMatch(/(?:async\s+)?generateBalanceSheet\s*\(/m);
    });

    it("α48: generateIncomeStatement method is declared on FinancialStatementsService", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).toMatch(/(?:async\s+)?generateIncomeStatement\s*\(/m);
    });

    it("α49: exporter methods returning Buffer are declared (PDF + Excel)", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).toMatch(/exportBalanceSheetPdf\s*\(/m);
      expect(content).toMatch(/exportIncomeStatementPdf\s*\(/m);
      expect(content).toMatch(/Promise<Buffer>/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — REQ-005 money math preservation
  // Service must consume money utilities FROM domain/money.utils (NOT redefine),
  // and must NOT runtime-import @/generated/prisma/client directly.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — REQ-005 money math preservation", () => {
    // Match RUNTIME import only (NOT `import type`).
    const PRISMA_RUNTIME_RE =
      /^\s*import\s+(?!type\s)\{?[^}]*\}?\s*from\s+["']@\/generated\/prisma\/client["']/m;

    it("α50: financial-statements.service imports from domain/money.utils (preserves money math source)", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      // Accept any import form referencing the canonical money.utils path:
      // - `import { foo } from "../domain/money.utils"`
      // - `import "../domain/money.utils"` (side-effect, anchors the source)
      // - absolute alias `@/modules/accounting/financial-statements/domain/money.utils`
      expect(content).toMatch(
        /(?:from\s+|import\s+)["'](?:\.\.\/domain\/money\.utils|@\/modules\/accounting\/financial-statements\/domain\/money\.utils)["']/m,
      );
    });

    it("α51: financial-statements.service does NOT runtime-import @/generated/prisma/client", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α52: financial-statements.service preserves builder + calculator domain composition", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      // The service orchestrates the pure builders + retained-earnings calculator
      // from domain — both must be referenced.
      expect(content).toMatch(/buildBalanceSheet/m);
      expect(content).toMatch(/buildIncomeStatement/m);
      expect(content).toMatch(/calculateRetainedEarnings/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — REQ-006 NEGATIVE — application R2: no infra imports, no Prisma client
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — REQ-006 NEGATIVE: application layer R2 (no cross-layer infrastructure deps)", () => {
    // Catch any infrastructure REPO/ADAPTER import (R2: application must not
    // depend on Prisma repos or port adapters directly — must inject via deps).
    // Exclude infrastructure/exporters/ — exporters are pure Node-runtime utils
    // legitimately consumed by the application layer (moved from features/ to
    // infrastructure/exporters/ at C2 GREEN per design §2 D6; this exclusion
    // is the sentinel regex calibration per [[red_regex_discipline]] — semantic
    // intent preserved: "no Prisma repo or adapter import in application/").
    const INFRA_REPO_IMPORT_RE =
      /from\s+["'](?:\.\.\/infrastructure\/(?!exporters)[^"']+|@\/modules\/[^"']+\/infrastructure\/(?!exporters)[^"']+)["']/m;
    // No direct repository class instantiation either — must inject via deps.
    const SELF_WIRE_RE = /new\s+PrismaFinancialStatementsRepo\s*\(/m;

    it("α53: financial-statements.service does NOT import from infrastructure repos/adapters (exporters exempt per D6)", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).not.toMatch(INFRA_REPO_IMPORT_RE);
    });

    it("α54: financial-statements.service does NOT self-instantiate the Prisma repo (deps-object only)", () => {
      const content = readApplicationFile("financial-statements.service.ts");
      expect(content).not.toMatch(SELF_WIRE_RE);
    });
  });
});
