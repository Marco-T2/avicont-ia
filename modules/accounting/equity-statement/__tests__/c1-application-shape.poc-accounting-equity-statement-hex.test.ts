import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C1 RED — Application layer shape tests for POC accounting-equity-statement-hex.
 * Paired sister: modules/accounting/trial-balance/__tests__/c1-application-shape.poc-accounting-trial-balance-hex.test.ts
 *                (GREEN `47b98180` — deps-object ctor + port injection pattern).
 *
 * Strategy: readFileSync regex assertions on:
 *   - application/income-statement-source.port.ts (absent pre-GREEN → ENOENT) [AXIS-DISTINCT]
 *   - application/equity-statement.service.ts (absent pre-GREEN → ENOENT)
 *   - application/make-equity-statement-service.ts (absent pre-GREEN → ENOENT)
 * All 14α FAIL pre-GREEN via ENOENT per [[red_acceptance_failure_mode]].
 * C0 25α stable; this RED adds α26..α39 (14 new).
 *
 * AXIS-DISTINCT vs TB sister (12α):
 *   +2α for IncomeStatementSourcePort block (α26..α28) — NEW application-layer port
 *   +2α for D10 + REQ-011 NEGATIVE block (α34..α37) — FS PRES/INFRA guard
 *
 * REQ mapping (5 blocks / 14α):
 * - Block 1 (α26..α28): IncomeStatementSourcePort — NEW axis-distinct port [REQ-012]
 * - Block 2 (α29..α31): deps-object ctor + 2-port injection (EquityStatementQueryPort +
 *   IncomeStatementSourcePort) [REQ-005]
 * - Block 3 (α32..α33): service surface — generate method + NO self-wire
 * - Block 4 (α34..α37): D10 + REQ-011 NEGATIVE (buildIncomeStatement + calculateRetainedEarnings
 *   imports PRESENT; zero FS PRES/INFRA imports)
 * - Block 5 (α38..α39): money math preservation (buildEquityStatement) + no server-only
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any `modules/accounting/equity-statement/infrastructure/**`
 * paths (C2 target paths excluded from C1 assertions — verified).
 * The only forward-looking patterns are NEGATIVE assertions that infra classes MUST NOT
 * appear inside the application service — these are NEGATIVE, not existence checks on C2 files.
 *
 * Ledger: α26..α39 ALL FAIL via ENOENT. α1..α25 (C0) STILL PASS.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const APPLICATION = path.join(ROOT, "modules/accounting/equity-statement/application");

function applicationFile(relative: string): string {
  return path.join(APPLICATION, relative);
}

function readApplicationFile(relative: string): string {
  const filePath = applicationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/equity-statement/application/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC accounting-equity-statement-hex C1 — application layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — IncomeStatementSourcePort (NEW — axis-distinct, REQ-012)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — IncomeStatementSourcePort (axis-distinct, REQ-012)", () => {
    it("α26: IncomeStatementSourcePort interface is exported from application/income-statement-source.port", () => {
      const content = readApplicationFile("income-statement-source.port.ts");
      expect(content).toMatch(/export\s+interface\s+IncomeStatementSourcePort/m);
    });

    it("α27: IncomeStatementSourcePort declares findAccountsWithSubtype method", () => {
      const content = readApplicationFile("income-statement-source.port.ts");
      expect(content).toMatch(/findAccountsWithSubtype/m);
    });

    it("α28: IncomeStatementSourcePort declares aggregateJournalLinesInRange method", () => {
      const content = readApplicationFile("income-statement-source.port.ts");
      expect(content).toMatch(/aggregateJournalLinesInRange/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — deps-object ctor + 2-port injection (REQ-005)
  // AXIS-DISTINCT vs TB: 2-port ctor ({ repo, incomeSource }) vs TB single-port.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — deps-object ctor + 2-port injection (REQ-005)", () => {
    it("α29: EquityStatementService class is exported from application/equity-statement.service", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).toMatch(/export\s+class\s+EquityStatementService/m);
    });

    it("α30: EquityStatementService ctor accepts a deps object (no optional zero-arg form)", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      // POSITIVE: constructor accepts non-optional structured arg
      // NEGATIVE: no `constructor(repo?: ...)` optional fallback (zero-arg legacy form)
      expect(content).toMatch(
        /constructor\s*\(\s*(?:\{|\w+\s*:\s*EquityStatementServiceDeps)/m,
      );
      expect(content).not.toMatch(/constructor\s*\(\s*repo\?\s*:/m);
    });

    it("α31: EquityStatementService ctor consumes BOTH EquityStatementQueryPort AND IncomeStatementSourcePort", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).toMatch(/EquityStatementQueryPort/m);
      expect(content).toMatch(/IncomeStatementSourcePort/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — Service surface
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Service surface", () => {
    it("α32: generate method is declared on EquityStatementService", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).toMatch(/(?:async\s+)?generate\s*\(/m);
    });

    it("α33: EquityStatementService does NOT self-instantiate any concrete repo or adapter", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).not.toMatch(/new\s+PrismaEquityStatementRepo\s*\(/m);
      expect(content).not.toMatch(/new\s+PrismaIncomeStatementSourceAdapter\s*\(/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — D10 + REQ-011 NEGATIVE sentinel (AXIS-DISTINCT — NEW)
  // D10: FS domain pure functions TOLERATED at application layer.
  // REQ-011 NEGATIVE: zero FS PRESENTATION / INFRASTRUCTURE imports in application/.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — D10 cross-module domain imports + REQ-011 NEGATIVE", () => {
    const FS_PRES_IMPORT_RE =
      /from\s+["']@\/modules\/accounting\/financial-statements\/presentation/m;
    const FS_INFRA_IMPORT_RE =
      /from\s+["']@\/modules\/accounting\/financial-statements\/infrastructure/m;

    it("α34: equity-statement.service imports buildIncomeStatement from FS domain (D10 tolerated cross-module domain import)", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).toMatch(/buildIncomeStatement/m);
    });

    it("α35: equity-statement.service imports calculateRetainedEarnings from FS domain (D10)", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).toMatch(/calculateRetainedEarnings/m);
    });

    it("α36: equity-statement.service does NOT import from @/modules/accounting/financial-statements/presentation (REQ-011 NEGATIVE)", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).not.toMatch(FS_PRES_IMPORT_RE);
    });

    it("α37: equity-statement.service does NOT import from @/modules/accounting/financial-statements/infrastructure (REQ-011 NEGATIVE)", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).not.toMatch(FS_INFRA_IMPORT_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 5 — money math preservation + server-only NEGATIVE
  // Application layer R2: NO server-only (belongs in presentation/server.ts only).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 5 — money math preservation + server-only NEGATIVE", () => {
    const SERVER_ONLY_RE = /import\s+["']server-only["']/m;

    it("α38: equity-statement.service imports buildEquityStatement from domain/equity-statement.builder (preserves builder composition)", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).toMatch(/buildEquityStatement/m);
    });

    it("α39: equity-statement.service does NOT contain import 'server-only' (REQ-003 — application layer is not server-only)", () => {
      const content = readApplicationFile("equity-statement.service.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });
  });
});
