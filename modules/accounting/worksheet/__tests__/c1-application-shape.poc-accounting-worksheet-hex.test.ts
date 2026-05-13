import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C1 RED — Application layer shape tests for POC accounting-worksheet-hex.
 * Paired sister: modules/accounting/trial-balance/__tests__/c1-application-shape.poc-accounting-trial-balance-hex.test.ts
 *                (GREEN `47b98180` — deps-object ctor + port injection pattern).
 *
 * Strategy: readFileSync regex assertions on:
 *   - application/worksheet.service.ts (absent pre-GREEN → ENOENT)
 *   - application/make-worksheet-service.ts (absent pre-GREEN → ENOENT)
 * All 12α FAIL pre-GREEN via ENOENT per [[red_acceptance_failure_mode]].
 * C0 25α stable; this RED adds α26..α37 (12 new).
 *
 * Axis-distinct vs TB:
 * - Method name: `generateWorksheet()` (NOT `generate()`) — WS-specific, locked α89 in C4.
 * - Port: WorksheetQueryPort (single-port, WS-D2).
 * - No IncomeStatementSourcePort (single-port architecture).
 *
 * REQ mapping (6 blocks / 12α):
 * - Block 1 (α26..α28): deps-object ctor + port injection (WorksheetQueryPort)
 * - Block 2 (α29..α30): service surface — generateWorksheet method + NO self-wire
 * - Block 3 (α31..α32): REQ-006 money math preservation (buildWorksheet import +
 *   no Prisma runtime in application layer)
 * - Block 4 (α33): composition-root placeholder — makeWorksheetService exported
 * - Block 5 (α34..α35): REQ-006 NEGATIVE — no infra imports + no server-only
 * - Block 6 (α36..α37): application barrel — WorksheetService ref in factory +
 *   no FS cross-import in service
 *
 * Cross-cycle gate [[cross_cycle_red_test_cementacion_gate]]:
 * This sentinel does NOT reference any `modules/accounting/worksheet/infrastructure/**`
 * paths (C2 target paths excluded from C1 assertions — verified).
 * SELF_WIRE_RE asserts class name is ABSENT — negative assertion, not C2 existence check.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const APPLICATION = path.join(ROOT, "modules/accounting/worksheet/application");

function applicationFile(relative: string): string {
  return path.join(APPLICATION, relative);
}

function readApplicationFile(relative: string): string {
  const filePath = applicationFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/worksheet/application/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

describe("POC accounting-worksheet-hex C1 — application layer shape", () => {
  // ───────────────────────────────────────────────────────────────────────────
  // Block 1 — deps-object ctor + port injection (REQ-005)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 1 — deps-object ctor + port injection (REQ-005)", () => {
    it("α26: WorksheetService class is exported from application/worksheet.service", () => {
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).toMatch(/export\s+class\s+WorksheetService/m);
    });

    it("α27: WorksheetService ctor accepts a deps object (no optional-repo zero-arg form)", () => {
      const content = readApplicationFile("worksheet.service.ts");
      // POSITIVE: constructor accepts non-optional structured deps arg
      // NEGATIVE: no `constructor(repo?: ...)` optional fallback (zero-arg legacy form banned)
      expect(content).toMatch(
        /constructor\s*\(\s*(?:\{|\w+\s*:\s*WorksheetServiceDeps)/m,
      );
      expect(content).not.toMatch(/constructor\s*\(\s*repo\?\s*:/m);
    });

    it("α28: WorksheetService consumes WorksheetQueryPort via deps", () => {
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).toMatch(/WorksheetQueryPort/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Service surface (REQ-005)
  // Axis-distinct: method name is `generateWorksheet` (NOT `generate`).
  // Preserved from features/ original — NOT renamed. Locked by α89.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Service surface", () => {
    it("α29: generateWorksheet method is declared on WorksheetService (worksheet-specific name preserved)", () => {
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).toMatch(/(?:async\s+)?generateWorksheet\s*\(/m);
    });

    it("α30: WorksheetService does NOT self-instantiate the Prisma repo (deps-object only)", () => {
      const SELF_WIRE_RE = /new\s+PrismaWorksheetRepo\s*\(/m;
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).not.toMatch(SELF_WIRE_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — REQ-006 money math preservation
  // Service must compose buildWorksheet from domain (not redefine),
  // and must NOT runtime-import @/generated/prisma/client directly.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — REQ-006 money math preservation", () => {
    const PRISMA_RUNTIME_RE =
      /^\s*import\s+(?!type\s)\{?[^}]*\}?\s*from\s+["']@\/generated\/prisma\/client["']/m;

    it("α31: worksheet.service imports buildWorksheet from domain/worksheet.builder (preserves builder composition)", () => {
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).toMatch(/buildWorksheet/m);
    });

    it("α32: worksheet.service does NOT runtime-import @/generated/prisma/client", () => {
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — composition-root placeholder
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — composition-root placeholder", () => {
    it("α33: makeWorksheetService is exported from application/make-worksheet-service", () => {
      const content = readApplicationFile("make-worksheet-service.ts");
      expect(content).toMatch(
        /export\s+(?:function\s+makeWorksheetService|const\s+makeWorksheetService\s*=)/m,
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

    it("α34: worksheet.service does NOT import from infrastructure repos/adapters", () => {
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).not.toMatch(INFRA_REPO_IMPORT_RE);
    });

    it("α35: worksheet.service does NOT contain import \"server-only\"", () => {
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 6 — application barrel (REQ-003) + REQ-009 cross-module guard
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 6 — application barrel + REQ-009 cross-module guard", () => {
    const FS_IMPORT_RE = /from\s+["']@\/modules\/accounting\/financial-statements/m;

    it("α36: WorksheetService is referenced in application/make-worksheet-service", () => {
      const content = readApplicationFile("make-worksheet-service.ts");
      expect(content).toMatch(/WorksheetService/m);
    });

    it("α37: worksheet.service does NOT import from @/modules/accounting/financial-statements (REQ-009)", () => {
      const content = readApplicationFile("worksheet.service.ts");
      expect(content).not.toMatch(FS_IMPORT_RE);
    });
  });
});
