import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C1 RED — Application layer shape tests for POC accounting-trial-balance-hex.
 * Paired sister: modules/accounting/financial-statements/__tests__/c1-application-shape.poc-financial-statements-hex.test.ts
 *                (GREEN `0fe2f58c` — deps-object ctor + port injection pattern).
 *
 * Strategy: readFileSync regex assertions on:
 *   - application/trial-balance.service.ts (absent pre-GREEN → ENOENT)
 *   - application/make-trial-balance-service.ts (absent pre-GREEN → ENOENT)
 * All 12α FAIL pre-GREEN via ENOENT per [[red_acceptance_failure_mode]].
 * C0 25α stable; this RED adds α26..α37 (12 new).
 *
 * REQ mapping (5 blocks / 12α):
 * - Block 1 (α26..α28): deps-object ctor + port injection (TrialBalanceQueryPort)
 * - Block 2 (α29..α30): service surface — generate method + NO self-wire
 * - Block 3 (α31..α32): REQ-006 money math preservation (buildTrialBalance import +
 *   no Prisma runtime in application layer)
 * - Block 4 (α33): composition-root placeholder — makeTrialBalanceService exported
 * - Block 5 (α34..α35): REQ-006 NEGATIVE — no infra imports + no server-only
 * - Block 6 (α36..α37): application barrel — TrialBalanceService ref in factory +
 *   no FS cross-import in service
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any `modules/accounting/trial-balance/infrastructure/**`
 * paths (C2 target paths excluded from C1 assertions — verified).
 * The only forward-looking pattern is SELF_WIRE_RE which asserts class name is ABSENT —
 * a NEGATIVE assertion, not an existence check on C2 files.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const APPLICATION = path.join(ROOT, "modules/accounting/trial-balance/application");

function applicationFile(relative: string): string {
  return path.join(APPLICATION, relative);
}

function readApplicationFile(relative: string): string {
  const filePath = applicationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/trial-balance/application/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC accounting-trial-balance-hex C1 — application layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — deps-object ctor + port injection (REQ-005)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — deps-object ctor + port injection (REQ-005)", () => {
    it("α26: TrialBalanceService class is exported from application/trial-balance.service", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).toMatch(/export\s+class\s+TrialBalanceService/m);
    });

    it("α27: TrialBalanceService ctor accepts a deps object (no optional-repo zero-arg form)", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      // ctor must accept a deps object — either destructured `({ repo })` or typed
      // `(deps: TrialBalanceServiceDeps)`. The defining invariant:
      // - POSITIVE: constructor accepts non-optional structured arg
      // - NEGATIVE: no `constructor(repo?: ...)` optional fallback (zero-arg legacy form)
      expect(content).toMatch(
        /constructor\s*\(\s*(?:\{|\w+\s*:\s*TrialBalanceServiceDeps)/m,
      );
      expect(content).not.toMatch(/constructor\s*\(\s*repo\?\s*:/m);
    });

    it("α28: TrialBalanceService consumes TrialBalanceQueryPort via deps", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).toMatch(/TrialBalanceQueryPort/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Service surface (REQ-005)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Service surface", () => {
    it("α29: generate method is declared on TrialBalanceService", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).toMatch(/(?:async\s+)?generate\s*\(/m);
    });

    it("α30: TrialBalanceService does NOT self-instantiate the Prisma repo (deps-object only)", () => {
      const SELF_WIRE_RE = /new\s+PrismaTrialBalanceRepo\s*\(/m;
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).not.toMatch(SELF_WIRE_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — REQ-006 money math preservation
  // Service must compose buildTrialBalance from domain (not redefine),
  // and must NOT runtime-import @/generated/prisma/client directly.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — REQ-006 money math preservation", () => {
    const PRISMA_RUNTIME_RE =
      /^\s*import\s+(?!type\s)\{?[^}]*\}?\s*from\s+["']@\/generated\/prisma\/client["']/m;

    it("α31: trial-balance.service imports buildTrialBalance from domain/trial-balance.builder (preserves builder composition)", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).toMatch(/buildTrialBalance/m);
    });

    it("α32: trial-balance.service does NOT runtime-import @/generated/prisma/client", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — composition-root placeholder
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — composition-root placeholder", () => {
    it("α33: makeTrialBalanceService is exported from application/make-trial-balance-service", () => {
      const content = readApplicationFile("make-trial-balance-service.ts");
      expect(content).toMatch(
        /export\s+(?:function\s+makeTrialBalanceService|const\s+makeTrialBalanceService\s*=)/m,
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

    it("α34: trial-balance.service does NOT import from infrastructure repos/adapters", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).not.toMatch(INFRA_REPO_IMPORT_RE);
    });

    it("α35: trial-balance.service does NOT contain import \"server-only\"", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 6 — application barrel (REQ-003) + REQ-009 cross-module guard
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 6 — application barrel + REQ-009 cross-module guard", () => {
    const FS_IMPORT_RE = /from\s+["']@\/modules\/accounting\/financial-statements/m;

    it("α36: TrialBalanceService is referenced in application/make-trial-balance-service", () => {
      const content = readApplicationFile("make-trial-balance-service.ts");
      expect(content).toMatch(/TrialBalanceService/m);
    });

    it("α37: trial-balance.service does NOT import from @/modules/accounting/financial-statements (REQ-009)", () => {
      const content = readApplicationFile("trial-balance.service.ts");
      expect(content).not.toMatch(FS_IMPORT_RE);
    });
  });
});
