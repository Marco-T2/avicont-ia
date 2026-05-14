import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C0 RED — Domain layer shape tests for poc-accounting-equity-statement-hex (OLEADA 6 sub-POC 2/8).
 * Paired sister: modules/accounting/trial-balance/__tests__/c0-domain-shape.poc-accounting-trial-balance-hex.test.ts (16b3a819 RED).
 *
 * Strategy: readFileSync / existsSync inside each it() block — domain files do NOT
 * exist pre-GREEN (ENOENT). See [[red_acceptance_failure_mode]] — expected failure
 * mode ENOENT for positive assertions (α1..α18); CONDITIONAL-PASS for NEGATIVE
 * assertions on absent files (α19..α25).
 *
 * REQ mapping:
 * - Block 1: Types (REQ-003, REQ-006) — α1..α5
 * - Block 2: Money utils — EX-D3 re-export shim from shared (REQ-006) — α6..α7
 *   (poc-accounting-exporters-cleanup sub-POC 6: standalone sumDecimals + eq
 *   consolidated into @/modules/accounting/shared/domain/money.utils)
 * - Block 3: Pure builder (REQ-006) — α8..α10
 * - Block 4: Validation schema (REQ-006) — α11
 * - Block 5: Port interface (REQ-003) — α12..α18 (6-method — AXIS-DISTINCT vs TB 3-method)
 * - Block 6: REQ-009 NEGATIVE — zero FS cross-import in domain — α19..α20
 * - Block 7: REQ-003 NEGATIVE — R5 absoluta + server-only banned in domain — α21..α25
 *
 * Ledger [[red_acceptance_failure_mode]]:
 *   α1..α18: FAIL (ENOENT — files absent pre-GREEN)
 *   α19..α25: CONDITIONAL-PASS (NEGATIVE regex on absent files → trivially pass)
 */

const ROOT = path.resolve(__dirname, "../../../..");
const DOMAIN = path.join(ROOT, "modules/accounting/equity-statement/domain");

function domainFile(relative: string): string {
  return path.join(DOMAIN, relative);
}

function readDomainFile(relative: string): string {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/equity-statement/domain/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

// Regex constants — EXACT mirror of sister sentinel [[red_regex_discipline]]
const PRISMA_RUNTIME_RE =
  /^\s*import\s+(?!type\s)\{?[^}]*\}?\s*from\s+["']@\/generated\/prisma\/client["']/m;
const SERVER_ONLY_RE = /import\s+["']server-only["']/m;
const INFRA_IMPORT_RE = /from\s+["']@\/modules\/[^"']+\/infrastructure/m;
const FS_PRES_IMPORT_RE =
  /from\s+["']@\/modules\/accounting\/financial-statements\/presentation/m;
const FS_ANY_IMPORT_RE =
  /from\s+["']@\/modules\/accounting\/financial-statements/m;

// ─────────────────────────────────────────────────────────────────────────────
// Block 1 — Types (REQ-003, REQ-006)
// ─────────────────────────────────────────────────────────────────────────────

describe("POC equity-statement-hex C0 — domain layer shape", () => {
  describe("Block 1 — Types (REQ-003: domain types in domain/)", () => {
    it("α1: EquityStatement type is exported from domain/equity-statement.types", () => {
      const content = readDomainFile("equity-statement.types.ts");
      expect(content).toMatch(/export\s+type\s+EquityStatement\b/m);
    });

    it("α2: ColumnKey union is exported from domain/equity-statement.types", () => {
      const content = readDomainFile("equity-statement.types.ts");
      expect(content).toMatch(/export\s+type\s+ColumnKey/m);
    });

    it("α3: RowKey union is exported from domain/equity-statement.types", () => {
      const content = readDomainFile("equity-statement.types.ts");
      expect(content).toMatch(/export\s+type\s+RowKey/m);
    });

    it("α4: SerializedEquityStatement type is exported from domain/equity-statement.types", () => {
      const content = readDomainFile("equity-statement.types.ts");
      expect(content).toMatch(/export\s+type\s+SerializedEquityStatement/m);
    });

    it("α5: BuildEquityStatementInput type is exported from domain/equity-statement.types", () => {
      const content = readDomainFile("equity-statement.types.ts");
      expect(content).toMatch(/export\s+type\s+BuildEquityStatementInput/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 2 — Money utils — EX-D3 re-export shim from shared (REQ-006)
  // poc-accounting-exporters-cleanup (sub-POC 6): the standalone sumDecimals + eq
  // copies were consolidated into @/modules/accounting/shared/domain/money.utils.
  // This module's money.utils is now a thin re-export shim.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Money utils (EX-D3 re-export shim from shared, REQ-006)", () => {
    it("α6: sumDecimals is re-exported from @/modules/accounting/shared/domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(
        /export\s+\{[^}]*\bsumDecimals\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/shared\/domain\/money\.utils["']/m,
      );
    });

    it("α7: eq is re-exported from @/modules/accounting/shared/domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(
        /export\s+\{[^}]*\beq\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/shared\/domain\/money\.utils["']/m,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 3 — Pure builder (REQ-006)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Pure builder (REQ-006)", () => {
    it("α8: buildEquityStatement is exported as function from domain/equity-statement.builder", () => {
      const content = readDomainFile("equity-statement.builder.ts");
      expect(content).toMatch(/export\s+function\s+buildEquityStatement/m);
    });

    it("α9: COLUMNS_ORDER constant is exported from domain/equity-statement.builder", () => {
      const content = readDomainFile("equity-statement.builder.ts");
      expect(content).toMatch(/export\s+const\s+COLUMNS_ORDER/m);
    });

    it("α10: mapAccountCodeToColumn function is exported from domain/equity-statement.builder", () => {
      const content = readDomainFile("equity-statement.builder.ts");
      expect(content).toMatch(/export\s+function\s+mapAccountCodeToColumn/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 4 — Validation schema (REQ-006)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 4 — Validation schema (REQ-006)", () => {
    it("α11: equityStatementQuerySchema is exported from domain/equity-statement.validation", () => {
      const content = readDomainFile("equity-statement.validation.ts");
      expect(content).toMatch(/export\s+const\s+equityStatementQuerySchema/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 5 — Port interface (REQ-003) — 6-method EquityStatementQueryPort (AXIS-DISTINCT vs TB 3-method)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 5 — Port interface (REQ-003: 6-method EquityStatementQueryPort)", () => {
    it("α12: EquityStatementQueryPort interface is exported from domain/ports/equity-statement-query.port", () => {
      const content = readDomainFile("ports/equity-statement-query.port.ts");
      expect(content).toMatch(/export\s+interface\s+EquityStatementQueryPort/m);
    });

    it("α13: EquityStatementQueryPort declares getPatrimonioBalancesAt method", () => {
      const content = readDomainFile("ports/equity-statement-query.port.ts");
      expect(content).toMatch(/getPatrimonioBalancesAt/m);
    });

    it("α14: EquityStatementQueryPort declares getTypedPatrimonyMovements method", () => {
      const content = readDomainFile("ports/equity-statement-query.port.ts");
      expect(content).toMatch(/getTypedPatrimonyMovements/m);
    });

    it("α15: EquityStatementQueryPort declares getAperturaPatrimonyDelta method", () => {
      const content = readDomainFile("ports/equity-statement-query.port.ts");
      expect(content).toMatch(/getAperturaPatrimonyDelta/m);
    });

    it("α16: EquityStatementQueryPort declares findPatrimonioAccounts method", () => {
      const content = readDomainFile("ports/equity-statement-query.port.ts");
      expect(content).toMatch(/findPatrimonioAccounts/m);
    });

    it("α17: EquityStatementQueryPort declares getOrgMetadata method", () => {
      const content = readDomainFile("ports/equity-statement-query.port.ts");
      expect(content).toMatch(/getOrgMetadata/m);
    });

    it("α18: EquityStatementQueryPort declares isClosedPeriodMatch method", () => {
      const content = readDomainFile("ports/equity-statement-query.port.ts");
      expect(content).toMatch(/isClosedPeriodMatch/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 6 — REQ-009 NEGATIVE: zero FS cross-import in domain (sub-POC-specific)
  // CONDITIONAL-PASS pre-GREEN: files don't exist → regex can't match → trivially pass.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 6 — REQ-009 NEGATIVE: zero financial-statements cross-import in domain", () => {
    it("α19: domain/equity-statement.builder does NOT import from @/modules/accounting/financial-statements", () => {
      if (!fs.existsSync(domainFile("equity-statement.builder.ts"))) return;
      const content = readDomainFile("equity-statement.builder.ts");
      expect(content).not.toMatch(FS_ANY_IMPORT_RE);
    });

    it("α20: domain/money.utils does NOT import from @/modules/accounting/financial-statements", () => {
      if (!fs.existsSync(domainFile("money.utils.ts"))) return;
      const content = readDomainFile("money.utils.ts");
      expect(content).not.toMatch(FS_ANY_IMPORT_RE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 7 — REQ-003 NEGATIVE: R5 absoluta (Prisma runtime + server-only banned)
  // CONDITIONAL-PASS pre-GREEN: files don't exist → regex can't match → trivially pass.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 7 — REQ-003 NEGATIVE: R5 absoluta + server-only banned in domain", () => {
    it("α21: domain/equity-statement.types does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("equity-statement.types.ts"))) return;
      const content = readDomainFile("equity-statement.types.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α22: domain/equity-statement.validation does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("equity-statement.validation.ts"))) return;
      const content = readDomainFile("equity-statement.validation.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α23: domain/ports/equity-statement-query.port does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("ports/equity-statement-query.port.ts"))) return;
      const content = readDomainFile("ports/equity-statement-query.port.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α24: domain/equity-statement.types does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("equity-statement.types.ts"))) return;
      const content = readDomainFile("equity-statement.types.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α25: domain/equity-statement.builder does NOT import from @/modules/accounting/financial-statements/presentation", () => {
      if (!fs.existsSync(domainFile("equity-statement.builder.ts"))) return;
      const content = readDomainFile("equity-statement.builder.ts");
      expect(content).not.toMatch(FS_PRES_IMPORT_RE);
    });
  });
});
