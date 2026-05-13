import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C0 RED — Domain layer shape tests for poc-accounting-initial-balance-hex (OLEADA 6 sub-POC 4/8).
 * Paired sister: modules/accounting/worksheet/__tests__/c0-domain-shape.poc-accounting-worksheet-hex.test.ts (c5d94070 RED).
 *
 * Strategy: readFileSync / existsSync inside each it() block — domain files do NOT
 * exist pre-GREEN (ENOENT). See [[red_acceptance_failure_mode]] — expected failure
 * mode ENOENT for positive assertions (α1..α17); CONDITIONAL-PASS for NEGATIVE
 * assertions on absent files (α11, α18..α23).
 *
 * IB axis-distinct (vs WS):
 * - NO Block 2 (IB-D1: NO type extraction — initial-balance.types.ts already clean)
 * - Block 1 has 6α (IB has 6 exported domain types vs WS 5)
 * - Block 2 (money.utils): α7 + α8 (sumDecimals + eq — both copied for interface shape parity)
 * - Block 3 (builder): α9 + α10 + α11 (buildInitialBalance + BuildInitialBalanceInput + no FS import)
 * - Block 4 (validation): α12
 * - Block 5 (port — FLAT path initial-balance.ports.ts): α13..α17 (4-method IB-D2 WIDER than WS 3-method)
 * - Block 6 (REQ-009 NEGATIVE): α18 + α19
 * - Block 7 (R5 absoluta + server-only): α20..α23
 *
 * Total: 23α (vs WS 25α — 2 fewer because IB-D1 removes Block 2 types.ts extraction)
 *
 * REQ mapping (7 blocks / 23α):
 * - Block 1 (α1-α6, REQ-003): domain/initial-balance.types — 6 types
 * - Block 2 (α7-α8, REQ-006): domain/money.utils — R1 EXCEPTION (sumDecimals + eq)
 * - Block 3 (α9-α11, REQ-006): domain/initial-balance.builder — buildInitialBalance + BuildInitialBalanceInput + no FS import
 * - Block 4 (α12, REQ-006): domain/initial-balance.validation — initialBalanceQuerySchema
 * - Block 5 (α13-α17, REQ-003 IB-D2): domain/initial-balance.ports — InitialBalanceQueryPort 4-method
 * - Block 6 (α18-α19, REQ-009 COND-PASS): zero FS cross-import in domain (NEGATIVE on absent files)
 * - Block 7 (α20-α23, REQ-003 COND-PASS): R5 absoluta + server-only banned in domain
 *
 * Ledger per [[enumerated_baseline_failure_ledger]]:
 * α1..α10, α12..α17 = 16 FAIL (ENOENT). α11, α18..α23 = 7 COND-PASS (NEGATIVE, files absent).
 */

const ROOT = path.resolve(__dirname, "../../../..");
const DOMAIN = path.join(ROOT, "modules/accounting/initial-balance/domain");

function domainFile(relative: string): string {
  return path.join(DOMAIN, relative);
}

function readDomainFile(relative: string): string {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/initial-balance/domain/${relative}'`,
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
// IB has 6 exported domain types (vs WS 5): +InitialBalanceOrgHeader
// ─────────────────────────────────────────────────────────────────────────────

describe("POC initial-balance-hex C0 — domain layer shape", () => {
  describe("Block 1 — Types (REQ-003: domain types in domain/)", () => {
    it("α1: InitialBalanceRow interface is exported from domain/initial-balance.types", () => {
      const content = readDomainFile("initial-balance.types.ts");
      expect(content).toMatch(/export\s+(?:interface|type)\s+InitialBalanceRow\b/m);
    });

    it("α2: InitialBalanceGroup interface is exported from domain/initial-balance.types", () => {
      const content = readDomainFile("initial-balance.types.ts");
      expect(content).toMatch(/export\s+(?:interface|type)\s+InitialBalanceGroup\b/m);
    });

    it("α3: InitialBalanceSection interface is exported from domain/initial-balance.types", () => {
      const content = readDomainFile("initial-balance.types.ts");
      expect(content).toMatch(/export\s+(?:interface|type)\s+InitialBalanceSection\b/m);
    });

    it("α4: InitialBalanceOrgHeader interface is exported from domain/initial-balance.types", () => {
      const content = readDomainFile("initial-balance.types.ts");
      expect(content).toMatch(/export\s+(?:interface|type)\s+InitialBalanceOrgHeader\b/m);
    });

    it("α5: InitialBalanceStatement interface is exported from domain/initial-balance.types", () => {
      const content = readDomainFile("initial-balance.types.ts");
      expect(content).toMatch(/export\s+(?:interface|type)\s+InitialBalanceStatement\b/m);
    });

    it("α6: BuildInitialBalanceInput interface is exported from domain/initial-balance.types", () => {
      const content = readDomainFile("initial-balance.types.ts");
      expect(content).toMatch(/export\s+(?:interface|type)\s+BuildInitialBalanceInput\b/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 2 — Money utils (R1 exception — REQ-006)
  // D4 Option A: sumDecimals + eq copied — 5th copy (FS+TB+ES+WS+IB).
  // Both copied for interface shape parity with sisters even though builder only uses sumDecimals.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Money utils (R1-permissible-value-type-exception, REQ-006)", () => {
    it("α7: sumDecimals is exported as function from domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(/export\s+function\s+sumDecimals/m);
    });

    it("α8: eq is exported as function from domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(/export\s+function\s+eq/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 3 — Pure builder (REQ-006)
  // α11: CONDITIONAL-PASS pre-GREEN (NEGATIVE on absent file)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Pure builder (REQ-006)", () => {
    it("α9: buildInitialBalance is exported as function from domain/initial-balance.builder", () => {
      const content = readDomainFile("initial-balance.builder.ts");
      expect(content).toMatch(/export\s+function\s+buildInitialBalance/m);
    });

    it("α10: BuildInitialBalanceInput type is referenced in domain/initial-balance.builder", () => {
      const content = readDomainFile("initial-balance.builder.ts");
      expect(content).toMatch(/BuildInitialBalanceInput/m);
    });

    it("α11: domain/initial-balance.builder does NOT import from @/modules/accounting/financial-statements (D4 Option A — REQ-009)", () => {
      if (!fs.existsSync(domainFile("initial-balance.builder.ts"))) return;
      const content = readDomainFile("initial-balance.builder.ts");
      expect(content).not.toMatch(FS_ANY_IMPORT_RE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 4 — Validation schema (REQ-006)
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 4 — Validation schema (REQ-006)", () => {
    it("α12: initialBalanceQuerySchema is exported from domain/initial-balance.validation", () => {
      const content = readDomainFile("initial-balance.validation.ts");
      expect(content).toMatch(/export\s+const\s+initialBalanceQuerySchema\b/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 5 — Port interface 4-method (REQ-003, IB-D2)
  // FLAT path: domain/initial-balance.ports.ts (NOT nested like WS domain/ports/*.ts)
  // 4-method port WIDER than WS/TB (3-method): IB-D2 LOCKED
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 5 — Port interface 4-method (REQ-003, IB-D2)", () => {
    it("α13: InitialBalanceQueryPort interface is exported from domain/initial-balance.ports", () => {
      const content = readDomainFile("initial-balance.ports.ts");
      expect(content).toMatch(/export\s+interface\s+InitialBalanceQueryPort/m);
    });

    it("α14: InitialBalanceQueryPort declares getInitialBalanceFromCA method", () => {
      const content = readDomainFile("initial-balance.ports.ts");
      expect(content).toMatch(/getInitialBalanceFromCA/m);
    });

    it("α15: InitialBalanceQueryPort declares getOrgMetadata method", () => {
      const content = readDomainFile("initial-balance.ports.ts");
      expect(content).toMatch(/getOrgMetadata/m);
    });

    it("α16: InitialBalanceQueryPort declares countCAVouchers method", () => {
      const content = readDomainFile("initial-balance.ports.ts");
      expect(content).toMatch(/countCAVouchers/m);
    });

    it("α17: InitialBalanceQueryPort declares getCADate method", () => {
      const content = readDomainFile("initial-balance.ports.ts");
      expect(content).toMatch(/getCADate/m);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 6 — REQ-009 NEGATIVE: zero FS cross-import in domain (sub-POC-specific)
  // CONDITIONAL-PASS pre-GREEN: files absent → regex can't match → trivially pass.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 6 — REQ-009 NEGATIVE: zero financial-statements cross-import in domain", () => {
    it("α18: domain/initial-balance.builder does NOT import from @/modules/accounting/financial-statements", () => {
      if (!fs.existsSync(domainFile("initial-balance.builder.ts"))) return;
      const content = readDomainFile("initial-balance.builder.ts");
      expect(content).not.toMatch(FS_ANY_IMPORT_RE);
    });

    it("α19: domain/money.utils does NOT import from @/modules/accounting/financial-statements", () => {
      if (!fs.existsSync(domainFile("money.utils.ts"))) return;
      const content = readDomainFile("money.utils.ts");
      expect(content).not.toMatch(FS_ANY_IMPORT_RE);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Block 7 — REQ-003 NEGATIVE: R5 absoluta (Prisma runtime + server-only banned)
  // CONDITIONAL-PASS pre-GREEN: files absent → regex can't match → trivially pass.
  // NOTE: initial-balance.types.ts uses `import type { Prisma, AccountSubtype }` (TYPE-ONLY)
  // — PRISMA_RUNTIME_RE correctly EXCLUDES this via `(?!type\s)` lookahead.
  // ─────────────────────────────────────────────────────────────────────────────

  describe("Block 7 — REQ-003 NEGATIVE: R5 absoluta + server-only banned in domain", () => {
    it("α20: domain/initial-balance.types does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("initial-balance.types.ts"))) return;
      const content = readDomainFile("initial-balance.types.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α21: domain/initial-balance.validation does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("initial-balance.validation.ts"))) return;
      const content = readDomainFile("initial-balance.validation.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α22: domain/initial-balance.ports does NOT runtime-import @/generated/prisma/client", () => {
      if (!fs.existsSync(domainFile("initial-balance.ports.ts"))) return;
      const content = readDomainFile("initial-balance.ports.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α23: domain/initial-balance.types does NOT contain import 'server-only'", () => {
      if (!fs.existsSync(domainFile("initial-balance.types.ts"))) return;
      const content = readDomainFile("initial-balance.types.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });
  });
});
