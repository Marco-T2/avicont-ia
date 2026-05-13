/**
 * T16 — Sign-flip invariant integration test (REQ-CA.6).
 *
 * Verifies that after flipping a Depreciación Acumulada account from
 * (isContraAccount=false, nature=DEUDORA) to (isContraAccount=true, nature=ACREEDORA),
 * the balance returned by resolveBalances has the SAME absolute value but POSITIVE sign.
 *
 * Also verifies the Balance Sheet builder correctly subtracts the contra balance
 * from ACTIVO_NO_CORRIENTE.total when the full pipeline runs.
 *
 * Algebraic identity:
 *   PRE: nature=DEUDORA  → balance = Σdebit − Σcredit = 0 − 120000 = −120000
 *   POST: nature=ACREEDORA → balance = Σcredit − Σdebit = 120000 − 0 = +120000
 *   |balance| = 120000 in both cases. Journal entries untouched.
 *
 * This test uses pure functions and mock data (no real DB).
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import { buildBalanceSheet } from "@/modules/accounting/financial-statements/domain/balance-sheet.builder";
import type {
  AccountMetadata,
  ResolvedBalance,
  BuildBalanceSheetInput,
} from "@/modules/accounting/financial-statements/domain/types/financial-statements.types";

const D = (v: string | number) => new Prisma.Decimal(v);

// ── Simulate resolveBalances sign formula for both nature values ──
// balance-source.resolver.ts line 94-96:
//   a.nature === "DEUDORA" ? debit.minus(credit) : credit.minus(debit)

function simulateResolveBalance(
  totalDebit: number,
  totalCredit: number,
  nature: "DEUDORA" | "ACREEDORA",
): Prisma.Decimal {
  const debit = D(totalDebit);
  const credit = D(totalCredit);
  return nature === "DEUDORA" ? debit.minus(credit) : credit.minus(debit);
}

// ── Fixture ──

// Journal entries: Σdebit=0, Σcredit=120000 (depreciation is always credited)
const TOTAL_DEBIT = 0;
const TOTAL_CREDIT = 120000;

describe("Sign-flip invariant (REQ-CA.6 — T16)", () => {
  it("PRE-backfill: nature=DEUDORA → balance = 0 - 120000 = -120000", () => {
    const balance = simulateResolveBalance(TOTAL_DEBIT, TOTAL_CREDIT, "DEUDORA");
    expect(balance.toNumber()).toBe(-120000);
  });

  it("POST-backfill: nature=ACREEDORA → balance = 120000 - 0 = +120000", () => {
    const balance = simulateResolveBalance(TOTAL_DEBIT, TOTAL_CREDIT, "ACREEDORA");
    expect(balance.toNumber()).toBe(120000);
  });

  it("|balance| is preserved: same absolute value pre and post backfill", () => {
    const preBal = simulateResolveBalance(TOTAL_DEBIT, TOTAL_CREDIT, "DEUDORA");
    const postBal = simulateResolveBalance(TOTAL_DEBIT, TOTAL_CREDIT, "ACREEDORA");
    expect(Math.abs(preBal.toNumber())).toBe(Math.abs(postBal.toNumber()));
  });

  it("POST-backfill: balance-sheet builder subtracts contra from ACTIVO_NO_CORRIENTE.total", () => {
    // Arrange: after backfill, Depreciación has nature=ACREEDORA + isContraAccount=true
    const edificios: AccountMetadata = {
      id: "acc-edificios",
      code: "1.2.2",
      name: "Edificios",
      level: 3,
      subtype: AccountSubtype.ACTIVO_NO_CORRIENTE,
      nature: "DEUDORA",
      isActive: true,
      isContraAccount: false,
    };

    const depreciacionPostBackfill: AccountMetadata = {
      id: "acc-deprec",
      code: "1.2.6",
      name: "Depreciación Acumulada",
      level: 3,
      subtype: AccountSubtype.ACTIVO_NO_CORRIENTE,
      nature: "ACREEDORA",     // ← flipped by backfill
      isActive: true,
      isContraAccount: true,   // ← flipped by backfill
    };

    // Edificios balance (pre-existing, unchanged)
    const edificiosBalance: ResolvedBalance = {
      accountId: "acc-edificios",
      balance: D("500000"),
    };

    // Depreciación balance (positive after nature flip: 120000 - 0 = +120000)
    const deprecBalance: ResolvedBalance = {
      accountId: "acc-deprec",
      balance: simulateResolveBalance(TOTAL_DEBIT, TOTAL_CREDIT, "ACREEDORA"),
    };

    const input: BuildBalanceSheetInput = {
      accounts: [edificios, depreciacionPostBackfill],
      balances: [edificiosBalance, deprecBalance],
      retainedEarningsOfPeriod: D("0"),
      date: new Date("2026-04-20"),
      periodStatus: "CLOSED",
      source: "snapshot",
    };

    // Act
    const result = buildBalanceSheet(input);

    // Assert: ACTIVO_NO_CORRIENTE.total = 500000 − 120000 = 380000
    const noCorr = result.assets.groups.find(
      (g) => g.subtype === AccountSubtype.ACTIVO_NO_CORRIENTE
    )!;
    expect(noCorr).toBeDefined();
    expect(noCorr.total.toNumber()).toBe(380000);

    // Asset total correctly reflects net of contra
    expect(result.assets.total.toNumber()).toBe(380000);
  });
});
