/**
 * RED — Worksheet builder netting + oppositeSignAccounts emission.
 *
 * Driving case: an ACTIVO non-contra account ended up with saldo acreedor
 * because a payment was posted against a cash account that had no prior
 * balance (data entry error in a test org). Old behavior dropped the
 * acreedor side via maxZero → grand totals imbalanced by exactly that amount.
 *
 * New behavior:
 * - bgActivo = saldoAjDeudor - saldoAjAcreedor (no max-clamp) for non-contra
 * - bgPasPat = saldoAjAcreedor - saldoAjDeudor (no max-clamp) for non-contra
 * - Accounts with opposite-sign saldo (anomaly) are emitted as
 *   `oppositeSignAccounts` so the UI can surface them as a data warning.
 * - Contra-accounts (depreciación, provisiones) are UNCHANGED — their
 *   acreedor balance in Activo is by-design and routed via the contra branch.
 *
 * Worksheet is an internal accountant's working paper (not a formal
 * financial statement), so showing anomalies in red + warning is more
 * useful than silently reclassifying. Decision per user 2026-05-15.
 *
 * Expected failure mode (pre-GREEN):
 * - bgActivo of anomalous account = 0 (max-clamp drops the negative) → test FAILS
 * - report.oppositeSignAccounts is undefined (field doesn't exist yet) → test FAILS
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { buildWorksheet, type BuildWorksheetInput } from "../domain/worksheet.builder";
import type { WorksheetAccountMetadata } from "../domain/types";

const D = (v: string | number) => new Decimal(String(v));

function makeAccount(
  overrides: Partial<WorksheetAccountMetadata> & Pick<WorksheetAccountMetadata, "id" | "type">,
): WorksheetAccountMetadata {
  return {
    id: overrides.id,
    code: overrides.code ?? `${overrides.id}.code`,
    name: overrides.name ?? `Account ${overrides.id}`,
    level: overrides.level ?? 3,
    type: overrides.type,
    nature: overrides.nature ?? "DEUDORA",
    isActive: overrides.isActive ?? true,
    isDetail: overrides.isDetail ?? true,
    isContraAccount: overrides.isContraAccount ?? false,
  };
}

type AggEntry = { accountId: string; totalDebit: Decimal; totalCredit: Decimal; nature: "DEUDORA" | "ACREEDORA" };
function agg(accountId: string, debit: string | number, credit: string | number, nature: AggEntry["nature"] = "DEUDORA"): AggEntry {
  return { accountId, totalDebit: D(debit), totalCredit: D(credit), nature };
}

describe("buildWorksheet — opposite-sign accounts (netting + warning emission)", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // Case 1: ACTIVO non-contra with credit balance → bgActivo NEGATIVE + listed
  // Scenario: Caja General was credited 20 with no prior debits (overpayment).
  // ──────────────────────────────────────────────────────────────────────────
  it("ACTIVO non-contra with saldoAjAcreedor>0 produces NEGATIVE bgActivo and is listed in oppositeSignAccounts", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1.1", name: "Caja General M/N", type: "ACTIVO", nature: "DEUDORA" }),
    ];
    const input: BuildWorksheetInput = {
      accounts,
      sumas: [agg("caja", 0, 20)],
      ajustes: [],
      dateFrom: new Date("2026-05-01"),
      dateTo: new Date("2026-05-31"),
    };

    const result = buildWorksheet(input);

    const cajaRow = result.groups.find((g) => g.accountType === "ACTIVO")?.rows[0];
    expect(cajaRow).toBeDefined();
    expect(cajaRow!.saldoAjAcreedor.toFixed(2)).toBe("20.00");
    expect(cajaRow!.saldoAjDeudor.toFixed(2)).toBe("0.00");
    expect(cajaRow!.bgActivo.toFixed(2)).toBe("-20.00");
    expect(cajaRow!.bgPasPat.toFixed(2)).toBe("0.00");

    expect(result.oppositeSignAccounts).toBeDefined();
    expect(result.oppositeSignAccounts).toHaveLength(1);
    expect(result.oppositeSignAccounts[0]).toMatchObject({
      code: "1.1.1.1",
      name: "Caja General M/N",
      accountType: "ACTIVO",
    });
    expect(result.oppositeSignAccounts[0].amount.toFixed(2)).toBe("-20.00");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 2: PASIVO non-contra with debit balance → bgPasPat NEGATIVE + listed
  // ──────────────────────────────────────────────────────────────────────────
  it("PASIVO non-contra with saldoAjDeudor>0 produces NEGATIVE bgPasPat and is listed in oppositeSignAccounts", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "cxp", code: "2.1.1.1", name: "CxP Comerciales", type: "PASIVO", nature: "ACREEDORA" }),
    ];
    const input: BuildWorksheetInput = {
      accounts,
      sumas: [agg("cxp", 50, 0, "ACREEDORA")],
      ajustes: [],
      dateFrom: new Date("2026-05-01"),
      dateTo: new Date("2026-05-31"),
    };

    const result = buildWorksheet(input);

    const cxpRow = result.groups.find((g) => g.accountType === "PASIVO")?.rows[0];
    expect(cxpRow).toBeDefined();
    expect(cxpRow!.bgPasPat.toFixed(2)).toBe("-50.00");
    expect(cxpRow!.bgActivo.toFixed(2)).toBe("0.00");

    expect(result.oppositeSignAccounts).toHaveLength(1);
    expect(result.oppositeSignAccounts[0]).toMatchObject({
      code: "2.1.1.1",
      accountType: "PASIVO",
    });
    expect(result.oppositeSignAccounts[0].amount.toFixed(2)).toBe("-50.00");
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 3: Integrated scenario from the bug report — netting balances grand totals.
  // Caja General paid 20 to Juan Patricio (CxP) without prior cash balance.
  // After netting: Σ bgActivo = Σ bgPasPat → imbalanced=false.
  // ──────────────────────────────────────────────────────────────────────────
  it("netting fixes grand-total imbalance when the only delta is an opposite-sign anomaly", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1.1", name: "Caja General M/N", type: "ACTIVO", nature: "DEUDORA" }),
      makeAccount({ id: "cxp", code: "2.1.1.1", name: "CxP Comerciales", type: "PASIVO", nature: "ACREEDORA" }),
    ];
    const input: BuildWorksheetInput = {
      accounts,
      sumas: [
        agg("caja", 0, 20),                    // Caja: Haber 20 (anomalía — saldo acreedor 20)
        agg("cxp", 20, 0, "ACREEDORA"),        // CxP:  Debe 20  (anomalía — saldo deudor 20)
      ],
      ajustes: [],
      dateFrom: new Date("2026-05-01"),
      dateTo: new Date("2026-05-31"),
    };

    const result = buildWorksheet(input);

    expect(result.grandTotals.bgActivo.toFixed(2)).toBe("-20.00");
    expect(result.grandTotals.bgPasPat.toFixed(2)).toBe("-20.00");
    expect(result.imbalanced).toBe(false);
    expect(result.imbalanceDelta.toFixed(2)).toBe("0.00");

    expect(result.oppositeSignAccounts).toHaveLength(2);
    const codes = result.oppositeSignAccounts.map((a) => a.code).sort();
    expect(codes).toEqual(["1.1.1.1", "2.1.1.1"]);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 4: Contra-account (depreciación) is NOT listed as anomaly.
  // Its acreedor saldo in ACTIVO is by-design, handled in its own branch.
  // ──────────────────────────────────────────────────────────────────────────
  it("contra-account (depreciación) is NOT included in oppositeSignAccounts", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "edif", code: "1.2.1", name: "Edificios", type: "ACTIVO", nature: "DEUDORA" }),
      makeAccount({ id: "depr", code: "1.2.6", name: "Depreciación Acumulada", type: "ACTIVO", nature: "ACREEDORA", isContraAccount: true }),
    ];
    const input: BuildWorksheetInput = {
      accounts,
      sumas: [
        agg("edif", 100000, 0),
        agg("depr", 0, 15000, "ACREEDORA"),
      ],
      ajustes: [],
      dateFrom: new Date("2026-05-01"),
      dateTo: new Date("2026-05-31"),
    };

    const result = buildWorksheet(input);

    expect(result.oppositeSignAccounts).toHaveLength(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Case 5: Clean case — no anomalies → oppositeSignAccounts is empty array.
  // ──────────────────────────────────────────────────────────────────────────
  it("no anomalies → oppositeSignAccounts is empty array (not undefined)", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "caja", code: "1.1.1.1", name: "Caja", type: "ACTIVO", nature: "DEUDORA" }),
    ];
    const input: BuildWorksheetInput = {
      accounts,
      sumas: [agg("caja", 100, 0)],
      ajustes: [],
      dateFrom: new Date("2026-05-01"),
      dateTo: new Date("2026-05-31"),
    };

    const result = buildWorksheet(input);

    expect(result.oppositeSignAccounts).toBeDefined();
    expect(result.oppositeSignAccounts).toEqual([]);
  });
});
