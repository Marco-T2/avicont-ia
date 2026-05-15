/**
 * RED — Trial-balance builder anomaly emission: oppositeSignAccounts.
 *
 * In the TB, each row aggregates one account. A row is "anomalous" when its
 * final saldo lands on the OPPOSITE side of its accounting `nature`:
 *
 *   - account.nature === "DEUDORA"   → expected `saldoDeudor` > 0
 *     but `saldoAcreedor` > 0 → anomaly
 *   - account.nature === "ACREEDORA" → expected `saldoAcreedor` > 0
 *     but `saldoDeudor` > 0  → anomaly
 *
 * The builder must emit these rows in `report.oppositeSignAccounts` so the UI
 * can highlight the offending cell in red and list the accounts for the
 * accountant to review before closing.
 *
 * Unlike the worksheet, TB totals stay balanced regardless (Σ saldoDeudor =
 * Σ saldoAcreedor by partida doble) — the anomaly list is a quality signal,
 * not a balance correction.
 *
 * Expected failure mode (pre-GREEN):
 *   - `report.oppositeSignAccounts` is undefined (field absent from shape)
 *   - `TrialBalanceAccountMetadata.nature` is required for the assertion but
 *     not yet in the type — fixtures will need it once GREEN.
 */
import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { buildTrialBalance, type BuildTrialBalanceInput } from "../domain/trial-balance.builder";
import type {
  TrialBalanceAccountMetadata,
  TrialBalanceMovement,
} from "../domain/trial-balance.types";

const D = (v: string | number) => new Decimal(String(v));

function makeAccount(
  overrides: Pick<TrialBalanceAccountMetadata, "id" | "code"> &
    Partial<TrialBalanceAccountMetadata>,
): TrialBalanceAccountMetadata {
  return {
    id: overrides.id,
    code: overrides.code,
    name: overrides.name ?? `Account ${overrides.id}`,
    isDetail: overrides.isDetail ?? true,
    nature: overrides.nature ?? "DEUDORA",
  };
}

function mov(accountId: string, debit: string | number, credit: string | number): TrialBalanceMovement {
  return { accountId, totalDebit: D(debit), totalCredit: D(credit) };
}

const DATE_FROM = new Date("2026-05-01");
const DATE_TO = new Date("2026-05-31");

describe("buildTrialBalance — opposite-nature anomaly emission", () => {
  it("DEUDORA account with saldoAcreedor > 0 is listed in oppositeSignAccounts", () => {
    const accounts: TrialBalanceAccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1.1", name: "Caja General M/N", nature: "DEUDORA" }),
    ];
    const movements: TrialBalanceMovement[] = [mov("caja", 0, 20)];
    const input: BuildTrialBalanceInput = { accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO };

    const result = buildTrialBalance(input);

    expect(result.oppositeSignAccounts).toBeDefined();
    expect(result.oppositeSignAccounts).toHaveLength(1);
    expect(result.oppositeSignAccounts[0]).toMatchObject({
      code: "1.1.1.1",
      name: "Caja General M/N",
      nature: "DEUDORA",
    });
    expect(result.oppositeSignAccounts[0].saldoDeudor.toFixed(2)).toBe("0.00");
    expect(result.oppositeSignAccounts[0].saldoAcreedor.toFixed(2)).toBe("20.00");
  });

  it("ACREEDORA account with saldoDeudor > 0 is listed in oppositeSignAccounts", () => {
    const accounts: TrialBalanceAccountMetadata[] = [
      makeAccount({ id: "cxp", code: "2.1.1.1", name: "CxP Comerciales", nature: "ACREEDORA" }),
    ];
    const movements: TrialBalanceMovement[] = [mov("cxp", 50, 0)];
    const input: BuildTrialBalanceInput = { accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO };

    const result = buildTrialBalance(input);

    expect(result.oppositeSignAccounts).toHaveLength(1);
    expect(result.oppositeSignAccounts[0]).toMatchObject({
      code: "2.1.1.1",
      nature: "ACREEDORA",
    });
    expect(result.oppositeSignAccounts[0].saldoDeudor.toFixed(2)).toBe("50.00");
  });

  it("normal rows (saldo matches nature) are NOT listed", () => {
    const accounts: TrialBalanceAccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1.1", nature: "DEUDORA" }),
      makeAccount({ id: "cxp", code: "2.1.1.1", nature: "ACREEDORA" }),
    ];
    const movements: TrialBalanceMovement[] = [
      mov("caja", 100, 0),  // saldoDeudor=100 → matches DEUDORA ✓
      mov("cxp", 0, 80),    // saldoAcreedor=80 → matches ACREEDORA ✓
    ];
    const input: BuildTrialBalanceInput = { accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO };

    const result = buildTrialBalance(input);

    expect(result.oppositeSignAccounts).toBeDefined();
    expect(result.oppositeSignAccounts).toEqual([]);
  });

  it("no anomalies → oppositeSignAccounts is an empty array (not undefined)", () => {
    const result = buildTrialBalance({
      accounts: [],
      movements: [],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    });
    expect(result.oppositeSignAccounts).toBeDefined();
    expect(result.oppositeSignAccounts).toEqual([]);
  });

  it("totals stay balanced even when anomalies are present (partida doble preserved)", () => {
    const accounts: TrialBalanceAccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1.1", nature: "DEUDORA" }),
      makeAccount({ id: "cxp", code: "2.1.1.1", nature: "ACREEDORA" }),
    ];
    // Paired anomaly: Caja credited 20, CxP debited 20 (balanced entry, but each lands on opposite side)
    const movements: TrialBalanceMovement[] = [
      mov("caja", 0, 20),
      mov("cxp", 20, 0),
    ];
    const input: BuildTrialBalanceInput = { accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO };

    const result = buildTrialBalance(input);

    expect(result.oppositeSignAccounts).toHaveLength(2);
    expect(result.imbalanced).toBe(false);
    expect(result.deltaSumas.toFixed(2)).toBe("0.00");
    expect(result.deltaSaldos.toFixed(2)).toBe("0.00");
  });
});
