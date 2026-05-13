/**
 * T06/T07/T08 — RED: builder tests (balanced, imbalanced, multiple CAs).
 * T09 GREEN will implement `../initial-balance.builder`.
 *
 * Covers:
 *   REQ-1  Grouping by AccountType then AccountSubtype
 *   REQ-5  Activo = Pasivo + Patrimonio invariant (imbalanced / imbalanceDelta)
 *   REQ-6  Subtotals per AccountSubtype
 *   REQ-11 Signed-net input convention (rows arrive already signed by the repo)
 *
 * All fixtures follow the repo contract: `amount` is already signed-net, i.e.
 * DEUDORA rows carry (debit − credit) and ACREEDORA rows carry (credit − debit).
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type {
  BuildInitialBalanceInput,
  InitialBalanceOrgHeader,
  InitialBalanceRow,
} from "../domain/initial-balance.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ORG_HEADER: InitialBalanceOrgHeader = {
  razonSocial: "Avicont Test S.A.",
  nit: "1234567890",
  representanteLegal: "",
  direccion: "Av. Siempre Viva 742",
  ciudad: "",
};

const DATE_AT = new Date("2024-01-01T00:00:00.000Z");

function makeInput(
  overrides: Partial<BuildInitialBalanceInput> = {},
): BuildInitialBalanceInput {
  return {
    orgId: "org-test",
    org: ORG_HEADER,
    dateAt: DATE_AT,
    rows: [],
    caCount: 1,
    ...overrides,
  };
}

describe("buildInitialBalance — balanced CA (T06)", () => {
  // Fixture: ACTIVO_CORRIENTE 100 + ACTIVO_NO_CORRIENTE 300 = 400
  //          PASIVO_CORRIENTE 150 + PATRIMONIO_CAPITAL 250     = 400
  const balancedRows: InitialBalanceRow[] = [
    { accountId: "a-caja",       code: "1.1.1", name: "Caja",              subtype: AccountSubtype.ACTIVO_CORRIENTE,     amount: D("100") },
    { accountId: "a-edif",       code: "1.2.1", name: "Edificios",         subtype: AccountSubtype.ACTIVO_NO_CORRIENTE,  amount: D("300") },
    { accountId: "a-prov",       code: "2.1.1", name: "Proveedores",       subtype: AccountSubtype.PASIVO_CORRIENTE,     amount: D("150") },
    { accountId: "a-capital",    code: "3.1.1", name: "Capital Social",    subtype: AccountSubtype.PATRIMONIO_CAPITAL,   amount: D("250") },
  ];

  it("returns two sections in order [ACTIVO, PASIVO_PATRIMONIO]", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: balancedRows }));
    expect(stmt.sections).toHaveLength(2);
    expect(stmt.sections[0].key).toBe("ACTIVO");
    expect(stmt.sections[1].key).toBe("PASIVO_PATRIMONIO");
  });

  it("ACTIVO section groups rows by subtype with correct subtotals", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: balancedRows }));
    const activo = stmt.sections[0];
    expect(activo.groups).toHaveLength(2);

    const corriente = activo.groups.find((g) => g.subtype === AccountSubtype.ACTIVO_CORRIENTE);
    const noCorriente = activo.groups.find((g) => g.subtype === AccountSubtype.ACTIVO_NO_CORRIENTE);
    expect(corriente).toBeDefined();
    expect(noCorriente).toBeDefined();
    expect(corriente!.subtotal.equals(D("100"))).toBe(true);
    expect(noCorriente!.subtotal.equals(D("300"))).toBe(true);
    expect(activo.sectionTotal.equals(D("400"))).toBe(true);
  });

  it("PASIVO_PATRIMONIO section groups rows by subtype with correct subtotals", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: balancedRows }));
    const pasivo = stmt.sections[1];
    expect(pasivo.groups).toHaveLength(2);

    const pCorr = pasivo.groups.find((g) => g.subtype === AccountSubtype.PASIVO_CORRIENTE);
    const patCap = pasivo.groups.find((g) => g.subtype === AccountSubtype.PATRIMONIO_CAPITAL);
    expect(pCorr).toBeDefined();
    expect(patCap).toBeDefined();
    expect(pCorr!.subtotal.equals(D("150"))).toBe(true);
    expect(patCap!.subtotal.equals(D("250"))).toBe(true);
    expect(pasivo.sectionTotal.equals(D("400"))).toBe(true);
  });

  it("imbalanced: false and imbalanceDelta: 0 when totals match", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: balancedRows }));
    expect(stmt.imbalanced).toBe(false);
    expect(stmt.imbalanceDelta.equals(D("0"))).toBe(true);
  });

  it("uses es-BO labels from formatSubtypeLabel for groups", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: balancedRows }));
    const corriente = stmt.sections[0].groups.find(
      (g) => g.subtype === AccountSubtype.ACTIVO_CORRIENTE,
    );
    expect(corriente!.label).toBe("Activo Corriente");
    expect(stmt.sections[0].label).toBe("ACTIVO");
    expect(stmt.sections[1].label).toBe("PASIVO Y PATRIMONIO");
  });
});

describe("buildInitialBalance — imbalanced CA (T07)", () => {
  // ACTIVO = 500, PASIVO+PATRIMONIO = 420, delta = 80
  const imbalancedRows: InitialBalanceRow[] = [
    { accountId: "a-caja",    code: "1.1.1", name: "Caja",           subtype: AccountSubtype.ACTIVO_CORRIENTE,   amount: D("500") },
    { accountId: "a-prov",    code: "2.1.1", name: "Proveedores",    subtype: AccountSubtype.PASIVO_CORRIENTE,   amount: D("170") },
    { accountId: "a-capital", code: "3.1.1", name: "Capital Social", subtype: AccountSubtype.PATRIMONIO_CAPITAL, amount: D("250") },
  ];

  it("imbalanced: true when ACTIVO total differs from PASIVO+PATRIMONIO", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: imbalancedRows }));
    expect(stmt.imbalanced).toBe(true);
  });

  it("imbalanceDelta equals the absolute Bs. difference between sections", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: imbalancedRows }));
    expect(stmt.imbalanceDelta.equals(D("80"))).toBe(true);
  });

  it("imbalanceDelta is non-negative even when PASIVO_PATRIMONIO > ACTIVO", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    // Swap: ACTIVO 100, PASIVO+PATRIMONIO 300 → delta should still be 200 (abs)
    const flippedRows: InitialBalanceRow[] = [
      { accountId: "a-caja",    code: "1.1.1", name: "Caja",           subtype: AccountSubtype.ACTIVO_CORRIENTE,   amount: D("100") },
      { accountId: "a-prov",    code: "2.1.1", name: "Proveedores",    subtype: AccountSubtype.PASIVO_CORRIENTE,   amount: D("100") },
      { accountId: "a-capital", code: "3.1.1", name: "Capital Social", subtype: AccountSubtype.PATRIMONIO_CAPITAL, amount: D("200") },
    ];
    const stmt = buildInitialBalance(makeInput({ rows: flippedRows }));
    expect(stmt.imbalanced).toBe(true);
    expect(stmt.imbalanceDelta.equals(D("200"))).toBe(true);
    expect(stmt.imbalanceDelta.isNegative()).toBe(false);
  });
});

describe("buildInitialBalance — multiple CAs (T08)", () => {
  const minimalRows: InitialBalanceRow[] = [
    { accountId: "a-caja",    code: "1.1.1", name: "Caja",           subtype: AccountSubtype.ACTIVO_CORRIENTE,   amount: D("100") },
    { accountId: "a-capital", code: "3.1.1", name: "Capital Social", subtype: AccountSubtype.PATRIMONIO_CAPITAL, amount: D("100") },
  ];

  it("caCount: 2 → multipleCA: true and caCount: 2 on statement", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: minimalRows, caCount: 2 }));
    expect(stmt.multipleCA).toBe(true);
    expect(stmt.caCount).toBe(2);
  });

  it("caCount: 1 → multipleCA: false and caCount: 1", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: minimalRows, caCount: 1 }));
    expect(stmt.multipleCA).toBe(false);
    expect(stmt.caCount).toBe(1);
  });

  it("caCount: 5 → multipleCA: true and caCount: 5", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: minimalRows, caCount: 5 }));
    expect(stmt.multipleCA).toBe(true);
    expect(stmt.caCount).toBe(5);
  });
});

describe("buildInitialBalance — edge cases", () => {
  it("skips rows whose subtype is not a balance-sheet subtype (INGRESO/GASTO)", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const rowsWithNoise: InitialBalanceRow[] = [
      { accountId: "a-caja",    code: "1.1.1", name: "Caja",           subtype: AccountSubtype.ACTIVO_CORRIENTE,   amount: D("100") },
      { accountId: "a-capital", code: "3.1.1", name: "Capital Social", subtype: AccountSubtype.PATRIMONIO_CAPITAL, amount: D("100") },
      // Noise: INGRESO / GASTO — should never appear in a CA, but if they do
      // the builder must silently skip them (they close before CA).
      { accountId: "a-ing",     code: "4.1.1", name: "Ventas",         subtype: AccountSubtype.INGRESO_OPERATIVO,  amount: D("9999") },
      { accountId: "a-gas",     code: "5.1.1", name: "Sueldos",        subtype: AccountSubtype.GASTO_OPERATIVO,    amount: D("8888") },
    ];
    const stmt = buildInitialBalance(makeInput({ rows: rowsWithNoise }));
    expect(stmt.sections[0].sectionTotal.equals(D("100"))).toBe(true);
    expect(stmt.sections[1].sectionTotal.equals(D("100"))).toBe(true);
    expect(stmt.imbalanced).toBe(false);
  });

  it("empty rows → two sections with zero totals and balanced", async () => {
    const { buildInitialBalance } = await import("../domain/initial-balance.builder");
    const stmt = buildInitialBalance(makeInput({ rows: [], caCount: 0 }));
    expect(stmt.sections[0].key).toBe("ACTIVO");
    expect(stmt.sections[0].groups).toHaveLength(0);
    expect(stmt.sections[0].sectionTotal.equals(D("0"))).toBe(true);
    expect(stmt.sections[1].key).toBe("PASIVO_PATRIMONIO");
    expect(stmt.sections[1].groups).toHaveLength(0);
    expect(stmt.sections[1].sectionTotal.equals(D("0"))).toBe(true);
    expect(stmt.imbalanced).toBe(false);
    expect(stmt.imbalanceDelta.equals(D("0"))).toBe(true);
    expect(stmt.multipleCA).toBe(false);
    expect(stmt.caCount).toBe(0);
  });
});
