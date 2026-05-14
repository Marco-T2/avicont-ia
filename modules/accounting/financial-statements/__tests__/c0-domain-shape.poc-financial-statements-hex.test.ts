import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * C0 RED — Domain layer shape tests for POC financial-statements-hex migration.
 * Paired sister: modules/ai-agent/__tests__/c0-domain-shape.poc-ai-agent-hex.test.ts (eb76f91e GREEN).
 *
 * Strategy: readFileSync / existsSync inside each it() block — domain files do NOT
 * exist pre-GREEN (ENOENT). See [[red_acceptance_failure_mode]] — expected failure
 * mode: ENOENT / "Cannot find module '@/modules/accounting/financial-statements/domain/...'".
 *
 * REQ mapping:
 * - Block 1: Types (REQ-003)
 * - Block 2: Value objects — StatementTableRow / SerializedColumn (REQ-003)
 * - Block 3: Money utils — R1 EXCEPTION permissible (REQ-005). EX-D3
 *   (poc-accounting-exporters-cleanup sub-POC 6): sumDecimals + eq re-exported
 *   from @/modules/accounting/shared/domain/money.utils; FS keeps 6 richer fns.
 * - Block 4: Pure calculators / resolvers / date presets (REQ-006)
 * - Block 5: Pure builders — balance-sheet / income-statement (REQ-006)
 * - Block 6: Ports — FinancialStatementsQueryPort + AccountSubtypeLabelPort (REQ-003)
 * - Block 7: Zod validation schemas (REQ-003)
 * - Block 8: REQ-003 NEGATIVE — R5 absoluta (Prisma runtime banned except money.utils R1 exception)
 */

const ROOT = path.resolve(__dirname, "../../../..");
const DOMAIN = path.join(ROOT, "modules/accounting/financial-statements/domain");

function domainFile(relative: string): string {
  return path.join(DOMAIN, relative);
}

function readDomainFile(relative: string): string {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot read '@/modules/accounting/financial-statements/domain/${relative}'`,
    );
  }
  return fs.readFileSync(filePath, "utf8");
}

function requireDomainExport(relative: string, exportName: string): unknown {
  const filePath = domainFile(relative);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `ENOENT: cannot find module '@/modules/accounting/financial-statements/domain/${relative}'`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(path.resolve(filePath));
  return mod[exportName];
}

// ─────────────────────────────────────────────────────────────────────────────
// Block 1 — Types (REQ-003)
// ─────────────────────────────────────────────────────────────────────────────

describe("POC financial-statements-hex C0 — domain layer shape", () => {
  describe("Block 1 — Types (REQ-003: domain types in domain/types/)", () => {
    it("α1: BalanceSheet type is exported from domain/types/financial-statements.types", () => {
      const content = readDomainFile("types/financial-statements.types.ts");
      expect(content).toMatch(/export\s+type\s+BalanceSheet/m);
    });

    it("α2: IncomeStatement type is exported from domain/types/financial-statements.types", () => {
      const content = readDomainFile("types/financial-statements.types.ts");
      expect(content).toMatch(/export\s+type\s+IncomeStatement/m);
    });

    it("α3: StatementColumn type is exported from domain/types/financial-statements.types", () => {
      const content = readDomainFile("types/financial-statements.types.ts");
      expect(content).toMatch(/export\s+type\s+StatementColumn/m);
    });

    it("α4: BreakdownBy type is exported from domain/types/financial-statements.types", () => {
      const content = readDomainFile("types/financial-statements.types.ts");
      expect(content).toMatch(/export\s+type\s+BreakdownBy/m);
    });

    it("α5: CompareWith type is exported from domain/types/financial-statements.types", () => {
      const content = readDomainFile("types/financial-statements.types.ts");
      expect(content).toMatch(/export\s+type\s+CompareWith/m);
    });

    it("α6: DatePresetId type is exported from domain/types/financial-statements.types", () => {
      const content = readDomainFile("types/financial-statements.types.ts");
      expect(content).toMatch(/export\s+type\s+DatePresetId/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 2 — Value objects (REQ-003)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 2 — Value objects (REQ-003: serialization VOs in domain)", () => {
    it("α7: StatementTableRow type is exported from domain/value-objects/statement-table-rows.utils", () => {
      const content = readDomainFile("value-objects/statement-table-rows.utils.ts");
      expect(content).toMatch(/export\s+type\s+StatementTableRow/m);
    });

    it("α8: SerializedColumn type is exported from domain/value-objects/statement-table-rows.utils", () => {
      const content = readDomainFile("value-objects/statement-table-rows.utils.ts");
      expect(content).toMatch(/export\s+type\s+SerializedColumn/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 3 — Money utils (R1 EXCEPTION — Prisma.Decimal permissible)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 3 — Money utils (REQ-005: money math precision; R1-permissible-value-type-exception)", () => {
    // money.utils runtime-imports Prisma (R1 exception); require() at test time
    // cannot resolve @/ aliases (Vitest 4.1 strip-types loader). Use regex on
    // export declarations — sister C0 ai-agent precedent for same constraint.
    it("α9: roundHalfUp is exported from domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(/export\s+function\s+roundHalfUp/m);
    });

    // EX-D3 (poc-accounting-exporters-cleanup sub-POC 6): sumDecimals + eq were
    // consolidated into @/modules/accounting/shared/domain/money.utils. FS
    // money.utils re-exports them from shared while KEEPING its 6 richer fns
    // (roundHalfUp, formatBolivianAmount, zeroDecimal, toDecimal, isDecimal,
    // serializeStatement) — it is NOT a thin shim.
    it("α10: sumDecimals is re-exported from @/modules/accounting/shared/domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(
        /export\s+\{[^}]*\bsumDecimals\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/shared\/domain\/money\.utils["']/m,
      );
    });

    it("α11: eq is re-exported from @/modules/accounting/shared/domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(
        /export\s+\{[^}]*\beq\b[^}]*\}\s+from\s+["']@\/modules\/accounting\/shared\/domain\/money\.utils["']/m,
      );
    });

    it("α12: formatBolivianAmount is exported from domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(/export\s+function\s+formatBolivianAmount/m);
    });

    it("α13: serializeStatement is exported from domain/money.utils", () => {
      const content = readDomainFile("money.utils.ts");
      expect(content).toMatch(/export\s+function\s+serializeStatement/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 4 — Pure calculators / resolvers / date presets (REQ-006)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 4 — Pure calculators / resolvers / date presets (REQ-006: pure functions)", () => {
    it("α14: calculateRetainedEarnings is a function exported from domain/retained-earnings.calculator", () => {
      const calculateRetainedEarnings = requireDomainExport(
        "retained-earnings.calculator.ts",
        "calculateRetainedEarnings",
      );
      expect(typeof calculateRetainedEarnings).toBe("function");
    });

    it("α15: resolveBalances is exported from domain/balance-source.resolver", () => {
      // balance-source.resolver runtime-imports @/features/shared/errors;
      // require() cannot resolve the alias — regex on export declaration.
      const content = readDomainFile("balance-source.resolver.ts");
      expect(content).toMatch(/export\s+async\s+function\s+resolveBalances/m);
    });

    it("α16: resolveDatePreset is a function exported from domain/date-presets.utils", () => {
      const resolveDatePreset = requireDomainExport(
        "date-presets.utils.ts",
        "resolveDatePreset",
      );
      expect(typeof resolveDatePreset).toBe("function");
    });

    it("α17: generateBreakdownBuckets is a function exported from domain/date-presets.utils", () => {
      const generateBreakdownBuckets = requireDomainExport(
        "date-presets.utils.ts",
        "generateBreakdownBuckets",
      );
      expect(typeof generateBreakdownBuckets).toBe("function");
    });

    it("α18: buildBalanceSheetTableRows is a function exported from domain/value-objects/statement-table-rows.utils", () => {
      const buildBalanceSheetTableRows = requireDomainExport(
        "value-objects/statement-table-rows.utils.ts",
        "buildBalanceSheetTableRows",
      );
      expect(typeof buildBalanceSheetTableRows).toBe("function");
    });

    it("α19: buildIncomeStatementTableRows is a function exported from domain/value-objects/statement-table-rows.utils", () => {
      const buildIncomeStatementTableRows = requireDomainExport(
        "value-objects/statement-table-rows.utils.ts",
        "buildIncomeStatementTableRows",
      );
      expect(typeof buildIncomeStatementTableRows).toBe("function");
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 5 — Pure builders (REQ-006)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 5 — Pure builders (REQ-006: balance-sheet + income-statement aggregators)", () => {
    // Builders runtime-import @/generated/prisma/enums + the canonical
    // formatSubtypeLabel from @/modules/accounting/domain; require() cannot
    // resolve @/ aliases — regex on export declaration.
    it("α20: buildBalanceSheet is exported from domain/balance-sheet.builder", () => {
      const content = readDomainFile("balance-sheet.builder.ts");
      expect(content).toMatch(/export\s+function\s+buildBalanceSheet/m);
    });

    it("α21: buildIncomeStatement is exported from domain/income-statement.builder", () => {
      const content = readDomainFile("income-statement.builder.ts");
      expect(content).toMatch(/export\s+function\s+buildIncomeStatement/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 6 — Ports (REQ-003)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 6 — Ports (REQ-003: port interfaces in domain)", () => {
    it("α22: FinancialStatementsQueryPort interface is exported from domain/ports/financial-statements-query.port", () => {
      const content = readDomainFile("ports/financial-statements-query.port.ts");
      expect(content).toMatch(/export\s+interface\s+FinancialStatementsQueryPort/m);
    });

    it("α23: FinancialStatementsQueryPort declares findFiscalPeriod method", () => {
      const content = readDomainFile("ports/financial-statements-query.port.ts");
      expect(content).toMatch(/findFiscalPeriod/m);
    });

    it("α24: AccountSubtypeLabelPort interface is exported from domain/ports/account-subtype-label.port", () => {
      const content = readDomainFile("ports/account-subtype-label.port.ts");
      expect(content).toMatch(/export\s+interface\s+AccountSubtypeLabelPort/m);
    });

    it("α25: AccountSubtypeLabelPort declares formatSubtypeLabel method", () => {
      const content = readDomainFile("ports/account-subtype-label.port.ts");
      expect(content).toMatch(/formatSubtypeLabel/m);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 7 — Zod validation schemas (REQ-003)
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 7 — Zod validation schemas (REQ-003: pure Zod in domain)", () => {
    it("α26: balanceSheetQuerySchema parses a valid balance-sheet query", () => {
      const balanceSheetQuerySchema = requireDomainExport(
        "financial-statements.validation.ts",
        "balanceSheetQuerySchema",
      ) as { safeParse: (data: unknown) => { success: boolean } };
      const result = balanceSheetQuerySchema.safeParse({ date: "2026-03-31" });
      expect(result.success).toBe(true);
    });

    it("α27: balanceSheetQuerySchema rejects missing date", () => {
      const balanceSheetQuerySchema = requireDomainExport(
        "financial-statements.validation.ts",
        "balanceSheetQuerySchema",
      ) as { safeParse: (data: unknown) => { success: boolean } };
      const result = balanceSheetQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("α28: incomeStatementQuerySchema parses a valid income-statement query", () => {
      const incomeStatementQuerySchema = requireDomainExport(
        "financial-statements.validation.ts",
        "incomeStatementQuerySchema",
      ) as { safeParse: (data: unknown) => { success: boolean } };
      const result = incomeStatementQuerySchema.safeParse({
        dateFrom: "2026-01-01",
        dateTo: "2026-03-31",
      });
      expect(result.success).toBe(true);
    });

    it("α29: incomeStatementQuerySchema rejects missing dateFrom + dateTo + periodId", () => {
      const incomeStatementQuerySchema = requireDomainExport(
        "financial-statements.validation.ts",
        "incomeStatementQuerySchema",
      ) as { safeParse: (data: unknown) => { success: boolean } };
      const result = incomeStatementQuerySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Block 8 — REQ-003 NEGATIVE — R5 absoluta
  //   R1-permissible-value-type-exception: money.utils is EXEMPT from this block
  //   (Prisma.Decimal is decimal.js value-type engine, not Prisma entity type).
  //   Sister precedent: modules/shared/domain/value-objects/money.ts:4-10.
  // ───────────────────────────────────────────────────────────────────────────

  describe("Block 8 — REQ-003 NEGATIVE: R5 absoluta (Prisma RUNTIME banned, money.utils EXEMPT per R1 exception)", () => {
    // Match RUNTIME import only (NOT `import type`).
    // Examples that MATCH: `import { Prisma } from "@/generated/prisma/client"`
    // Examples that DON'T match: `import type { Prisma } from "@/generated/prisma/client"`
    const PRISMA_RUNTIME_RE =
      /^\s*import\s+(?!type\s)\{?[^}]*\}?\s*from\s+["']@\/generated\/prisma\/client["']/m;
    const INFRA_IMPORT_RE = /from\s+["']@\/modules\/[^"']+\/infrastructure/m;
    const SERVER_ONLY_RE = /import\s+["']server-only["']/m;

    it("α30: domain/balance-sheet.builder does NOT runtime-import @/generated/prisma/client", () => {
      const content = readDomainFile("balance-sheet.builder.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α31: domain/income-statement.builder does NOT runtime-import @/generated/prisma/client", () => {
      const content = readDomainFile("income-statement.builder.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α32: domain/retained-earnings.calculator does NOT runtime-import @/generated/prisma/client", () => {
      const content = readDomainFile("retained-earnings.calculator.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α33: domain/balance-source.resolver does NOT runtime-import @/generated/prisma/client", () => {
      const content = readDomainFile("balance-source.resolver.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α34: domain/date-presets.utils does NOT runtime-import @/generated/prisma/client", () => {
      const content = readDomainFile("date-presets.utils.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α35: domain/value-objects/statement-table-rows.utils does NOT runtime-import @/generated/prisma/client", () => {
      const content = readDomainFile("value-objects/statement-table-rows.utils.ts");
      expect(content).not.toMatch(PRISMA_RUNTIME_RE);
    });

    it("α36: domain/balance-sheet.builder does NOT import from infrastructure", () => {
      const content = readDomainFile("balance-sheet.builder.ts");
      expect(content).not.toMatch(INFRA_IMPORT_RE);
    });

    it("α37: domain/income-statement.builder does NOT import from infrastructure", () => {
      const content = readDomainFile("income-statement.builder.ts");
      expect(content).not.toMatch(INFRA_IMPORT_RE);
    });

    it("α38: domain/balance-sheet.builder does NOT contain 'server-only' import", () => {
      const content = readDomainFile("balance-sheet.builder.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α39: domain/income-statement.builder does NOT contain 'server-only' import", () => {
      const content = readDomainFile("income-statement.builder.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α40: domain/types/financial-statements.types does NOT contain 'server-only' import", () => {
      const content = readDomainFile("types/financial-statements.types.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α41: domain/ports/financial-statements-query.port does NOT contain 'server-only' import", () => {
      const content = readDomainFile("ports/financial-statements-query.port.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });

    it("α42: domain/financial-statements.validation does NOT contain 'server-only' import", () => {
      const content = readDomainFile("financial-statements.validation.ts");
      expect(content).not.toMatch(SERVER_ONLY_RE);
    });
  });
});
