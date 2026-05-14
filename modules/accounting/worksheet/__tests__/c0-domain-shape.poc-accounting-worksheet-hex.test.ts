import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C0 RED — Domain layer shape tests for poc-accounting-worksheet-hex (OLEADA 6 sub-POC 3/8).
 * Paired sister: modules/accounting/trial-balance/__tests__/c0-domain-shape.poc-accounting-trial-balance-hex.test.ts (16b3a819 RED).
 *
 * Strategy: readFileSync / existsSync inside each it() block — domain files do NOT
 * exist pre-GREEN (ENOENT). See [[red_acceptance_failure_mode]] — expected failure
 * mode ENOENT for positive assertions (α1..α17); CONDITIONAL-PASS for NEGATIVE
 * assertions on absent files (α12, α18..α25).
 *
 * WS axis-distinct: Block 2 adds α6..α7 (WS-D1 domain/types.ts — WorksheetMovementAggregation
 * + WorksheetAccountMetadata extracted from infra). Block 4 adds α12 (builder NOT importing
 * from "./worksheet.repository"). Port path: domain/ports/worksheet-query.port.ts.
 *
 * REQ mapping (8 blocks / 25α):
 * - Block 1 (α1-α5, REQ-003): domain/worksheet.types — 5 types
 * - Block 2 (α6-α7, WS-D1): domain/types.ts — WorksheetMovementAggregation + WorksheetAccountMetadata
 * - Block 3 (α8-α9, REQ-006): domain/money.utils — EX-D3 re-export shim from shared
 *   (poc-accounting-exporters-cleanup sub-POC 6: standalone sumDecimals + eq
 *   consolidated into @/modules/accounting/shared/domain/money.utils)
 * - Block 4 (α10-α12, REQ-006): domain/worksheet.builder — buildWorksheet + BuildWorksheetInput + no repo import
 * - Block 5 (α13, REQ-006): domain/worksheet.validation — worksheetQuerySchema
 * - Block 6 (α14-α17, REQ-003): domain/ports/worksheet-query.port — WorksheetQueryPort + 3 methods
 * - Block 7 (α18-α19, REQ-009 COND-PASS): zero FS cross-import in domain (NEGATIVE on absent files)
 * - Block 8 (α20-α25, REQ-003 COND-PASS): R5 absoluta + server-only banned in domain
 *
 * Ledger: α1..α17 FAIL (ENOENT). α12,α18..α25 CONDITIONAL-PASS (NEGATIVE, files absent).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const DOMAIN = path.join(ROOT, "modules/accounting/worksheet/domain");

function domainFile(relative: string): string {
  return path.join(DOMAIN, relative);
}

function readDomainFile(relative: string): string {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/worksheet/domain/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

// Regex constants — EXACT mirror of sister sentinel [[red_regex_discipline]]
const PRISMA_RUNTIME_RE =
  /^\s*import\s+(?!type\s)\{?[^}]*\}?\s*from\s+["']@\/generated\/prisma\/client["']/m;
const SERVER_ONLY_RE = /import\s+["']server-only["']/m;
const FS_ANY_IMPORT_RE =
  /from\s+["']@\/modules\/accounting\/financial-statements/m;

// ─────────────────────────────────────────────────────────────────────────────
// Block 1 — Types (REQ-003, REQ-006)
// ─────────────────────────────────────────────────────────────────────────────

describe("POC worksheet-hex C0 — domain layer shape", () => {
  describe("Block 1 — Types (REQ-003: domain types in domain/)", () => {
    it("α1: WorksheetRow type is exported from domain/worksheet.types", () => {
      const content = readDomainFile("worksheet.types.ts");
      expect(content).toMatch(/export\s+type\s+WorksheetRow\b/m);
    });

    it("α2: WorksheetTotals type is exported from domain/worksheet.types", () => {
      const content = readDomainFile("worksheet.types.ts");
      expect(content).toMatch(/export\s+type\s+WorksheetTotals\b/m);
    });

    it("α3: WorksheetGroup type is exported from domain/worksheet.types", () => {
      const content = readDomainFile("worksheet.types.ts");
      expect(content).toMatch(/export\s+type\s+WorksheetGroup\b/m);
    });

    it("α4: WorksheetFilters type is exported from domain/worksheet.types", () => {
      const content = readDomainFile("worksheet.types.ts");
      expect(content).toMatch(/export\s+type\s+WorksheetFilters\b/m);
    });

    it("α5: WorksheetReport type is exported from domain/worksheet.types", () => {
      const content = readDomainFile("worksheet.types.ts");
      expect(content).toMatch(/export\s+type\s+WorksheetReport\b/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 2 — WS-D1 domain/types.ts (extracted infra types)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 2 — WS-D1: WorksheetMovementAggregation + WorksheetAccountMetadata in domain/types.ts", () => {
    it("α6: WorksheetMovementAggregation is exported from domain/types", () => {
      const content = readDomainFile("types.ts");
      expect(content).toMatch(/export\s+type\s+WorksheetMovementAggregation\b/m);
    });

    it("α7: WorksheetAccountMetadata is exported from domain/types", () => {
      const content = readDomainFile("types.ts");
      expect(content).toMatch(/export\s+type\s+WorksheetAccountMetadata\b/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 3 — Money utils — EX-D3 re-export shim from shared (REQ-006)
  // poc-accounting-exporters-cleanup (sub-POC 6): the standalone sumDecimals + eq
  // copies were consolidated into @/modules/accounting/shared/domain/money.utils.
  // This module's money.utils is now a thin re-export shim.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Money utils (EX-D3 re-export shim from shared, REQ-006)", () => {
    it("α8: sumDecimals is re-exported from @/modules/accounting/shared/domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(
        /export\s+\{[^}]*\bsumDecimals\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/shared\/domain\/money\.utils["']/m,
      );
    });

    it("α9: eq is re-exported from @/modules/accounting/shared/domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(
        /export\s+\{[^}]*\beq\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/shared\/domain\/money\.utils["']/m,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 4 — Pure builder (REQ-006)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 4 — Pure builder (REQ-006)", () => {
    it("α10: buildWorksheet is exported as function from domain/worksheet.builder", () => {
      const content = readDomainFile("worksheet.builder.ts");
      expect(content).toMatch(/export\s+function\s+buildWorksheet/m);
    });

    it("α11: BuildWorksheetInput type is exported from domain/worksheet.builder", () => {
      const content = readDomainFile("worksheet.builder.ts");
      expect(content).toMatch(/export\s+type\s+BuildWorksheetInput/m);
    });

    it("α12: domain/worksheet.builder does NOT import from \"./worksheet.repository\" (WS-D1 — import rewritten to ./types)", () => {
      if (!fs.existsSync(domainFile("worksheet.builder.ts"))) return;
      const content = readDomainFile("worksheet.builder.ts");
      expect(content).not.toMatch(/from\s+["']\.\/worksheet\.repository["']/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 5 — Validation schema (REQ-006)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 5 — Validation schema (REQ-006)", () => {
    it("α13: worksheetQuerySchema is exported from domain/worksheet.validation", () => {
      const content = readDomainFile("worksheet.validation.ts");
      expect(content).toMatch(/export\s+const\s+worksheetQuerySchema\b/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 6 — Port interface (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 6 — Port interface (REQ-003)", () => {
    it("α14: WorksheetQueryPort interface is exported from domain/ports/worksheet-query.port", () => {
      const content = readDomainFile("ports/worksheet-query.port.ts");
      expect(content).toMatch(/export\s+interface\s+WorksheetQueryPort/m);
    });

    it("α15: WorksheetQueryPort declares findFiscalPeriod method", () => {
      const content = readDomainFile("ports/worksheet-query.port.ts");
      expect(content).toMatch(/findFiscalPeriod/m);
    });

    it("α16: WorksheetQueryPort declares aggregateByAdjustmentFlag method", () => {
      const content = readDomainFile("ports/worksheet-query.port.ts");
      expect(content).toMatch(/aggregateByAdjustmentFlag/m);
    });

    it("α17: WorksheetQueryPort declares findAccountsWithDetail method", () => {
      const content = readDomainFile("ports/worksheet-query.port.ts");
      expect(content).toMatch(/findAccountsWithDetail/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 7 — REQ-009 NEGATIVE: zero FS cross-import in domain (sub-POC-specific)
  // CONDITIONAL-PASS pre-GREEN: files don't exist → regex can't match → trivially pass.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 7 — REQ-009 NEGATIVE: zero financial-statements cross-import in domain", () => {
    it("α18: domain/worksheet.builder does NOT import from @/modules/accounting/financial-statements", () => {
      if (!fs.existsSync(domainFile("worksheet.builder.ts"))) return;
      const content = readDomainFile("worksheet.builder.ts");
      expect(content).not.toMatch(FS_ANY_IMPORT_RE);
    });

    it("α19: domain/money.utils does NOT import from @/modules/accounting/financial-statements", () => {
      if (!fs.existsSync(domainFile("money.utils.ts"))) return;
      const content = readDomainFile("money.utils.ts");
      expect(content).not.toMatch(FS_ANY_IMPORT_RE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 8 — REQ-003 NEGATIVE: R5 absoluta (Prisma runtime + server-only banned)
  // CONDITIONAL-PASS pre-GREEN: files don't exist → regex can't match → trivially pass.
  // NOTE: worksheet.types.ts uses `import type { Prisma }` (TYPE-ONLY) — PRISMA_RUNTIME_RE
  // correctly EXCLUDES this via `(?!type\s)` lookahead.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 8 — REQ-003 NEGATIVE: R5 absoluta + server-only banned in domain", () => {
    it("α20: domain/worksheet.types does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("worksheet.types.ts"))) return;
      const content = readDomainFile("worksheet.types.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α21: domain/worksheet.validation does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("worksheet.validation.ts"))) return;
      const content = readDomainFile("worksheet.validation.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α22: domain/ports/worksheet-query.port does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("ports/worksheet-query.port.ts"))) return;
      const content = readDomainFile("ports/worksheet-query.port.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α23: domain/worksheet.types does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("worksheet.types.ts"))) return;
      const content = readDomainFile("worksheet.types.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α24: domain/worksheet.builder does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("worksheet.builder.ts"))) return;
      const content = readDomainFile("worksheet.builder.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α25: domain/worksheet.validation does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("worksheet.validation.ts"))) return;
      const content = readDomainFile("worksheet.validation.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });
  });
});
