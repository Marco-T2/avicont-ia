/**
 * RED — balance-sheet builder anomaly emission: oppositeSignAccounts.
 *
 * In the Balance General, a non-contra account whose final balance lands
 * on the opposite side of its accounting nature shows up as a NEGATIVE
 * balance after balance-source's signed conversion
 * (DEUDORA: D−C, ACREEDORA: C−D). The builder already nets it into the
 * section total (no max-clamp), so totals cuadran by themselves — what
 * was missing is surfacing the anomaly to the accountant.
 *
 * New contract: `report.oppositeSignAccounts: BalanceSheetOppositeSignAccount[]`
 * lists non-contra rows with negative balance, scoped to their section
 * (ACTIVO / PASIVO / PATRIMONIO). Contra-accounts (depreciación,
 * provisiones) are exempt by design. The synthetic retained-earnings
 * line is exempt because a negative there is a legitimate Pérdida del
 * Ejercicio, not a data anomaly.
 *
 * Expected failure mode (pre-GREEN): the field is undefined on the
 * report (shape change pending).
 */
import { describe, it, expect } from "vitest";
import { AccountSubtype } from "@/generated/prisma/enums";
import Decimal from "decimal.js";
import { buildBalanceSheet } from "../domain/balance-sheet.builder";
import type {
  BuildBalanceSheetInput,
  AccountMetadata,
} from "../domain/types/financial-statements.types";

const D = (v: string | number) => new Decimal(String(v));

function makeAccount(overrides: Partial<AccountMetadata> & Pick<AccountMetadata, "id" | "code">): AccountMetadata {
  return {
    id: overrides.id,
    code: overrides.code,
    name: overrides.name ?? `Account ${overrides.id}`,
    isActive: overrides.isActive ?? true,
    subtype: overrides.subtype ?? AccountSubtype.ACTIVO_CORRIENTE,
    isContraAccount: overrides.isContraAccount ?? false,
  };
}

const BASE_INPUT: Omit<BuildBalanceSheetInput, "accounts" | "balances"> = {
  retainedEarningsOfPeriod: D(0),
  date: new Date("2026-05-31"),
  periodStatus: "OPEN",
  source: "on-the-fly",
};

describe("buildBalanceSheet — opposite-sign anomaly emission", () => {
  it("ACTIVO non-contra with negative balance is listed", () => {
    const accounts: AccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1.1", name: "Caja General M/N", subtype: AccountSubtype.ACTIVO_CORRIENTE }),
    ];
    const input: BuildBalanceSheetInput = {
      ...BASE_INPUT,
      accounts,
      balances: [{ accountId: "caja", balance: D("-20") }],
    };

    const result = buildBalanceSheet(input);

    expect(result.oppositeSignAccounts).toBeDefined();
    expect(result.oppositeSignAccounts).toHaveLength(1);
    expect(result.oppositeSignAccounts[0]).toMatchObject({
      code: "1.1.1.1",
      name: "Caja General M/N",
      section: "ACTIVO",
    });
    expect(result.oppositeSignAccounts[0].balance.toFixed(2)).toBe("-20.00");
  });

  it("PASIVO non-contra with negative balance is listed", () => {
    const accounts: AccountMetadata[] = [
      makeAccount({ id: "cxp", code: "2.1.1.1", name: "CxP Comerciales", subtype: AccountSubtype.PASIVO_CORRIENTE }),
    ];
    const input: BuildBalanceSheetInput = {
      ...BASE_INPUT,
      accounts,
      balances: [{ accountId: "cxp", balance: D("-30") }],
    };

    const result = buildBalanceSheet(input);

    expect(result.oppositeSignAccounts).toHaveLength(1);
    expect(result.oppositeSignAccounts[0]).toMatchObject({
      code: "2.1.1.1",
      section: "PASIVO",
    });
  });

  it("contra-accounts (depreciación) are NOT listed even if balance is negative", () => {
    const accounts: AccountMetadata[] = [
      makeAccount({ id: "edif", code: "1.2.1", name: "Edificios", subtype: AccountSubtype.ACTIVO_NO_CORRIENTE }),
      makeAccount({
        id: "depr",
        code: "1.2.6",
        name: "Depreciación Acumulada",
        subtype: AccountSubtype.ACTIVO_NO_CORRIENTE,
        isContraAccount: true,
      }),
    ];
    const input: BuildBalanceSheetInput = {
      ...BASE_INPUT,
      accounts,
      balances: [
        { accountId: "edif", balance: D("100000") },
        { accountId: "depr", balance: D("15000") }, // positive — contra carries positive, subtracted at total
      ],
    };

    const result = buildBalanceSheet(input);

    expect(result.oppositeSignAccounts).toEqual([]);
  });

  it("synthetic retained-earnings line is NOT listed when negative (legitimate Pérdida)", () => {
    const accounts: AccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1", subtype: AccountSubtype.ACTIVO_CORRIENTE }),
    ];
    const input: BuildBalanceSheetInput = {
      ...BASE_INPUT,
      accounts,
      balances: [{ accountId: "caja", balance: D("100") }],
      retainedEarningsOfPeriod: D("-50"), // Pérdida del Ejercicio
    };

    const result = buildBalanceSheet(input);

    // The synthetic line gets pushed into PATRIMONIO_RESULTADOS with a negative balance,
    // but it's NOT a data anomaly — it's a real result for the period.
    expect(result.oppositeSignAccounts).toEqual([]);
  });

  it("no anomalies → oppositeSignAccounts is an empty array (not undefined)", () => {
    const accounts: AccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1", subtype: AccountSubtype.ACTIVO_CORRIENTE }),
    ];
    const input: BuildBalanceSheetInput = {
      ...BASE_INPUT,
      accounts,
      balances: [{ accountId: "caja", balance: D("100") }],
    };

    const result = buildBalanceSheet(input);

    expect(result.oppositeSignAccounts).toBeDefined();
    expect(result.oppositeSignAccounts).toEqual([]);
  });
});
