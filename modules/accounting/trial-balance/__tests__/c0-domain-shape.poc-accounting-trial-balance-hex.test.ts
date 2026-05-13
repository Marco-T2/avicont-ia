import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C0 RED — Domain layer shape tests for poc-accounting-trial-balance-hex (OLEADA 6 sub-POC 1/8).
 * Paired sister: modules/accounting/financial-statements/__tests__/c0-domain-shape.poc-financial-statements-hex.test.ts (bafcec65 GREEN).
 *
 * Strategy: readFileSync / existsSync inside each it() block — domain files do NOT
 * exist pre-GREEN (ENOENT). See [[red_acceptance_failure_mode]] — expected failure
 * mode ENOENT for positive assertions (α1..α14); CONDITIONAL-PASS for NEGATIVE
 * assertions on absent files (α15..α25).
 *
 * REQ mapping:
 * - Block 1: Types (REQ-003, REQ-006) — α1..α5
 * - Block 2: Money utils R1 EXCEPTION (REQ-006) — α6..α7
 * - Block 3: Pure builder (REQ-006) — α8..α9
 * - Block 4: Validation schema (REQ-006) — α10
 * - Block 5: Port interface (REQ-003) — α11..α14
 * - Block 6: REQ-009 NEGATIVE — zero FS cross-import in domain — α15..α16
 * - Block 7: REQ-003 NEGATIVE — R5 absoluta + server-only banned in domain — α17..α25
 */

const ROOT = path.resolve(__dirname, "../../../..");
const DOMAIN = path.join(ROOT, "modules/accounting/trial-balance/domain");

function domainFile(relative: string): string {
  return path.join(DOMAIN, relative);
}

function readDomainFile(relative: string): string {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/trial-balance/domain/${relative}'`,
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

describe("POC trial-balance-hex C0 — domain layer shape", () => {
  describe("Block 1 — Types (REQ-003: domain types in domain/)", () => {
    it("α1: TrialBalanceRow type is exported from domain/trial-balance.types", () => {
      const content = readDomainFile("trial-balance.types.ts");
      expect(content).toMatch(/export\s+type\s+TrialBalanceRow/m);
    });

    it("α2: TrialBalanceTotals type is exported from domain/trial-balance.types", () => {
      const content = readDomainFile("trial-balance.types.ts");
      expect(content).toMatch(/export\s+type\s+TrialBalanceTotals/m);
    });

    it("α3: TrialBalanceReport type is exported from domain/trial-balance.types", () => {
      const content = readDomainFile("trial-balance.types.ts");
      expect(content).toMatch(/export\s+type\s+TrialBalanceReport/m);
    });

    it("α4: TrialBalanceFilters type is exported from domain/trial-balance.types", () => {
      const content = readDomainFile("trial-balance.types.ts");
      expect(content).toMatch(/export\s+type\s+TrialBalanceFilters/m);
    });

    it("α5: SerializedTrialBalanceReport type is exported from domain/trial-balance.types", () => {
      const content = readDomainFile("trial-balance.types.ts");
      expect(content).toMatch(/export\s+type\s+SerializedTrialBalanceReport/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 2 — Money utils (R1 exception — REQ-006)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Money utils (R1-permissible-value-type-exception, REQ-006)", () => {
    it("α6: sumDecimals is exported as function from domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(/export\s+function\s+sumDecimals/m);
    });

    it("α7: eq is exported as function from domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(/export\s+function\s+eq/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 3 — Pure builder (REQ-006)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Pure builder (REQ-006)", () => {
    it("α8: buildTrialBalance is exported as function from domain/trial-balance.builder", () => {
      const content = readDomainFile("trial-balance.builder.ts");
      expect(content).toMatch(/export\s+function\s+buildTrialBalance/m);
    });

    it("α9: BuildTrialBalanceInput type is exported from domain/trial-balance.builder", () => {
      const content = readDomainFile("trial-balance.builder.ts");
      expect(content).toMatch(/export\s+type\s+BuildTrialBalanceInput/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 4 — Validation schema (REQ-006)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 4 — Validation schema (REQ-006)", () => {
    it("α10: trialBalanceQuerySchema is exported from domain/trial-balance.validation", () => {
      const content = readDomainFile("trial-balance.validation.ts");
      expect(content).toMatch(/export\s+const\s+trialBalanceQuerySchema/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 5 — Port interface (REQ-003)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 5 — Port interface (REQ-003)", () => {
    it("α11: TrialBalanceQueryPort interface is exported from domain/ports/trial-balance-query.port", () => {
      const content = readDomainFile("ports/trial-balance-query.port.ts");
      expect(content).toMatch(/export\s+interface\s+TrialBalanceQueryPort/m);
    });

    it("α12: TrialBalanceQueryPort declares aggregateAllVouchers method", () => {
      const content = readDomainFile("ports/trial-balance-query.port.ts");
      expect(content).toMatch(/aggregateAllVouchers/m);
    });

    it("α13: TrialBalanceQueryPort declares findAccounts method", () => {
      const content = readDomainFile("ports/trial-balance-query.port.ts");
      expect(content).toMatch(/findAccounts/m);
    });

    it("α14: TrialBalanceQueryPort declares getOrgMetadata method", () => {
      const content = readDomainFile("ports/trial-balance-query.port.ts");
      expect(content).toMatch(/getOrgMetadata/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 6 — REQ-009 NEGATIVE: zero FS cross-import in domain (sub-POC-specific)
  // CONDITIONAL-PASS pre-GREEN: files don't exist → regex can't match → trivially pass.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 6 — REQ-009 NEGATIVE: zero financial-statements cross-import in domain", () => {
    it("α15: domain/trial-balance.builder does NOT import from @/modules/accounting/financial-statements", () => {
      if (!fs.existsSync(domainFile("trial-balance.builder.ts"))) return;
      const content = readDomainFile("trial-balance.builder.ts");
      expect(content).not.toMatch(FS_ANY_IMPORT_RE);
    });

    it("α16: domain/money.utils does NOT import from @/modules/accounting/financial-statements", () => {
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
    it("α17: domain/trial-balance.types does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("trial-balance.types.ts"))) return;
      const content = readDomainFile("trial-balance.types.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α18: domain/trial-balance.validation does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("trial-balance.validation.ts"))) return;
      const content = readDomainFile("trial-balance.validation.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α19: domain/ports/trial-balance-query.port does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("ports/trial-balance-query.port.ts"))) return;
      const content = readDomainFile("ports/trial-balance-query.port.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α20: domain/trial-balance.types does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("trial-balance.types.ts"))) return;
      const content = readDomainFile("trial-balance.types.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α21: domain/trial-balance.builder does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("trial-balance.builder.ts"))) return;
      const content = readDomainFile("trial-balance.builder.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α22: domain/trial-balance.validation does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("trial-balance.validation.ts"))) return;
      const content = readDomainFile("trial-balance.validation.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α23: domain/ports/trial-balance-query.port does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("ports/trial-balance-query.port.ts"))) return;
      const content = readDomainFile("ports/trial-balance-query.port.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α24: domain/money.utils does NOT import from infrastructure", () => {
      if (!fs.existsSync(domainFile("money.utils.ts"))) return;
      const content = readDomainFile("money.utils.ts");
      expect(content).not.toMatch(INFRA_IMPORT_RE);
    });

    it("α25: domain/trial-balance.builder does NOT import from @/modules/accounting/financial-statements/presentation", () => {
      if (!fs.existsSync(domainFile("trial-balance.builder.ts"))) return;
      const content = readDomainFile("trial-balance.builder.ts");
      expect(content).not.toMatch(FS_PRES_IMPORT_RE);
    });
  });
});
