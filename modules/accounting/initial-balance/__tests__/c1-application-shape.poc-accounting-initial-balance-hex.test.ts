import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C1 RED — Application layer shape tests for POC accounting-initial-balance-hex.
 * Paired sister: modules/accounting/worksheet/__tests__/c1-application-shape.poc-accounting-worksheet-hex.test.ts
 *                (GREEN `cde818c5` — deps-object ctor + port injection pattern).
 *
 * Strategy: readFileSync regex assertions on:
 *   - application/initial-balance.service.ts (absent pre-GREEN → ENOENT)
 *   - application/make-initial-balance-service.ts (absent pre-GREEN → ENOENT)
 * 7 FAIL (ENOENT on positive assertions) + 5 CONDITIONAL-PASS (NEGATIVE on absent files).
 * C0 23α stable; this RED adds α24..α35 (12 new).
 *
 * Axis-distinct vs WS:
 * - Method name: `generate()` (NOT `generateWorksheet()`) — original name preserved (IB axis-distinct).
 * - Port: InitialBalanceQueryPort (4 methods — wider than WS 3-method).
 * - Ctor: positional-default → deps-object (IB-D4) — different refactor shape than WS optional-arg.
 * - REQ-011 NEGATIVE: no FS cross-imports in application layer (same as C0 REQ-009).
 *
 * RED acceptance failure mode [[red_acceptance_failure_mode]]:
 * - α24..α27, α29, α31, α34 (positive content on absent files): ENOENT → 7 FAIL
 * - α28, α30, α32, α33, α35 (NEGATIVE on absent files → CONDITIONAL-PASS): 5 COND-PASS
 *
 * REQ mapping (6 blocks / 12α):
 * - Block 1 (α24..α26): deps-object ctor + port injection (InitialBalanceQueryPort, IB-D4)
 * - Block 2 (α27..α28): service surface — generate() method + NO self-wire
 * - Block 3 (α29..α30): REQ-006 money math preservation (buildInitialBalance import +
 *   no Prisma runtime in application layer)
 * - Block 4 (α31): composition-root placeholder — makeInitialBalanceService exported
 * - Block 5 (α32..α33): REQ-006 NEGATIVE — no infra imports + no server-only
 * - Block 6 (α34..α35): application barrel — InitialBalanceService ref in factory +
 *   no FS cross-import in service
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any `modules/accounting/initial-balance/infrastructure/**`
 * paths (C2 target paths excluded from C1 assertions — verified).
 * SELF_WIRE_RE asserts class name is ABSENT — negative assertion, not C2 existence check.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const APPLICATION = path.join(ROOT, "modules/accounting/initial-balance/application");

function applicationFile(relative: string): string {
  return path.join(APPLICATION, relative);
}

function readApplicationFile(relative: string): string {
  const filePath = applicationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/initial-balance/application/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC accounting-initial-balance-hex C1 — application layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — deps-object ctor + port injection (REQ-005, IB-D4)
  // Axis-distinct vs WS: positional-default refactor (not optional-arg).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — deps-object ctor + port injection (REQ-005, IB-D4)", () => {
    it("α24: InitialBalanceService class is exported from application/initial-balance.service", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).toMatch(/export\s+class\s+InitialBalanceService/m);
    });

    it("α25: InitialBalanceService ctor accepts a deps object (IB-D4 — no positional-default form)", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      // POSITIVE: constructor accepts a destructured deps object { ... }
      expect(content).toMatch(/constructor\s*\(\s*\{/m);
      // NEGATIVE: forbid legacy positional-default `constructor(private readonly repo = new ...)`
      expect(content).not.toMatch(/constructor\s*\(\s*(?:private\s+readonly\s+)?repo\s*=/m);
    });

    it("α26: InitialBalanceService consumes InitialBalanceQueryPort via deps", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).toMatch(/InitialBalanceQueryPort/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Service surface (REQ-005)
  // Axis-distinct: method name is `generate` (NOT `generateWorksheet` or `generateInitialBalance`).
  // Original name preserved from features/ — NOT renamed (IB axis-distinct).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Service surface", () => {
    it("α27: generate method is declared on InitialBalanceService (original name preserved, NOT renamed)", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).toMatch(/(?:async\s+)?generate\s*\(/m);
    });

    it("α28: InitialBalanceService does NOT self-instantiate PrismaInitialBalanceRepo (deps-object only)", () => {
      const SELF_WIRE_RE = /new\s+PrismaInitialBalanceRepo\s*\(/m;
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).not.toMatch(SELF_WIRE_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — REQ-006 money math preservation
  // Service must compose buildInitialBalance from domain (not redefine),
  // and must NOT runtime-import @/generated/prisma/client directly.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — REQ-006 money math preservation", () => {
    const PRISMA_RUNTIME_RE =
      /^\s*import\s+(?!type\s)\{?[^}]*\}?\s*from\s+["']@\/generated\/prisma\/client["']/m;

    it("α29: initial-balance.service imports buildInitialBalance from domain/initial-balance.builder", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).toMatch(/buildInitialBalance/m);
    });

    it("α30: initial-balance.service does NOT runtime-import @/generated/prisma/client", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — composition-root placeholder
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — composition-root placeholder", () => {
    it("α31: makeInitialBalanceService is exported from application/make-initial-balance-service", () => {
      const content = readApplicationFile("make-initial-balance-service.ts");
      expect(content).toMatch(
        /export\s+(?:function\s+makeInitialBalanceService|const\s+makeInitialBalanceService\s*=)/m,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 5 — REQ-006 NEGATIVE: no infra imports in application + no server-only
  // Application layer R2: application can only depend on domain. NO server-only
  // (application is pure orchestration — server-only belongs in presentation/).
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 5 — REQ-006 NEGATIVE: application layer R2 (no infra deps, no server-only)", () => {
    const INFRA_REPO_IMPORT_RE =
      /from\s+["'](?:\.\.\/infrastructure\/(?!exporters)[^"']+|@\/modules\/[^"']+\/infrastructure\/(?!exporters)[^"']+)["']/m;
    const SERVER_ONLY_RE = /import\s+["']server-only["']/m;

    it("α32: initial-balance.service does NOT import from infrastructure repos/adapters", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).not.toMatch(INFRA_REPO_IMPORT_RE);
    });

    it("α33: initial-balance.service does NOT contain import \"server-only\"", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 6 — application barrel (REQ-003) + REQ-009/REQ-011 cross-module guard
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 6 — application barrel + REQ-009 FS cross-module guard", () => {
    const FS_IMPORT_RE = /from\s+["']@\/modules\/accounting\/financial-statements/m;

    it("α34: InitialBalanceService is referenced in application/make-initial-balance-service", () => {
      const content = readApplicationFile("make-initial-balance-service.ts");
      expect(content).toMatch(/InitialBalanceService/m);
    });

    it("α35: initial-balance.service does NOT import from @/modules/accounting/financial-statements", () => {
      const content = readApplicationFile("initial-balance.service.ts");
      expect(content).not.toMatch(FS_IMPORT_RE);
    });
  });
});
