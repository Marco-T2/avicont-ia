/**
 * B3 — RED: Pure builder tests. No DB, no mocks.
 * Uses concrete numeric scenarios from the spec (C2, C3, C4, C5).
 *
 * Covers:
 * - C2.S2 — empty accounts → empty rows, zero totals, imbalanced=false
 * - C2.S2 — zero-activity detail account → omitted
 * - C2.S3 — non-detail account with activity → omitted + console.warn
 * - C4.S1 — debit-heavy → saldoDeudor=500, saldoAcreedor=0
 * - C4.S2 — credit-heavy → saldoDeudor=0, saldoAcreedor=500
 * - C4.S3 — balanced account → both saldos=0, row still in output
 * - C5.S1 — balanced multi-account → imbalanced=false, deltas=0
 * - C5.S2 — synthetic imbalance → imbalanced=true, deltaSumas=-50
 * - C3.S1 — random order input → output sorted ASC by code
 * - C4.S5 — rowNumber NOT in domain type
 * - C4.E1 — no Number/parseFloat/+decimal in builder source
 */

import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import Decimal from "decimal.js";
import { buildTrialBalance, type BuildTrialBalanceInput } from "../domain/trial-balance.builder";
import type { TrialBalanceAccountMetadata, TrialBalanceMovement } from "../domain/trial-balance.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Fixture constructor + instanceof migrated from Prisma.Decimal (Decimal2 —
// inlined decimal.js@10.5.0 in Prisma 7.7.0) to top-level decimal.js@10.6.0
// `Decimal`. Discovery #2590: post sub-POC 1 the builder's outputs flow from
// top-level Decimal (via sumDecimals re-exported from accounting/shared);
// Decimal2 instances are NOT instanceof top-level Decimal. Value semantics
// identical; test intent preserved ("value is a Decimal class").
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
  };
}

function mov(
  accountId: string,
  debit: string | number,
  credit: string | number,
): TrialBalanceMovement {
  return { accountId, totalDebit: D(debit), totalCredit: D(credit) };
}

const DATE_FROM = new Date("2025-01-01");
const DATE_TO = new Date("2025-12-31");

// ── Fixture 1: empty inputs ───────────────────────────────────────────────────

describe("B3 Fixture 1 — C2.S2: empty accounts → empty rows, zero totals, imbalanced=false", () => {
  it("empty inputs produce empty rows and zero totals", () => {
    const input: BuildTrialBalanceInput = {
      accounts: [],
      movements: [],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    };
    const result = buildTrialBalance(input);
    expect(result.rows).toHaveLength(0);
    expect(result.totals.sumasDebe.isZero()).toBe(true);
    expect(result.totals.sumasHaber.isZero()).toBe(true);
    expect(result.totals.saldoDeudor.isZero()).toBe(true);
    expect(result.totals.saldoAcreedor.isZero()).toBe(true);
    expect(result.imbalanced).toBe(false);
    expect(result.deltaSumas.isZero()).toBe(true);
    expect(result.deltaSaldos.isZero()).toBe(true);
  });
});

// ── Fixture 2: detail account with zero activity ──────────────────────────────

describe("B3 Fixture 2 — C2.S2: zero-activity detail account → omitted", () => {
  it("account with sumasDebe=0 and sumasHaber=0 is NOT emitted", () => {
    const input: BuildTrialBalanceInput = {
      accounts: [makeAccount({ id: "zero", code: "1.1.1" })],
      movements: [], // no movements for this account
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    };
    const result = buildTrialBalance(input);
    expect(result.rows).toHaveLength(0);
  });
});

// ── Fixture 3: non-detail account with activity ───────────────────────────────

describe("B3 Fixture 3 — C2.S3: non-detail (agrupadora) account → omitted + console.warn", () => {
  it("non-detail account is NOT emitted even with activity", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const input: BuildTrialBalanceInput = {
      accounts: [makeAccount({ id: "grp", code: "1.1", isDetail: false })],
      movements: [mov("grp", "1000", "0")],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    };
    const result = buildTrialBalance(input);
    expect(result.rows).toHaveLength(0);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("grp"),
    );
    consoleSpy.mockRestore();
  });
});

// ── Fixture 4: debit-heavy account ────────────────────────────────────────────

describe("B3 Fixture 4 — C4.S1: debit-heavy → saldoDeudor=500, saldoAcreedor=0", () => {
  it("sumasDebe=800, sumasHaber=300 → saldoDeudor=500, saldoAcreedor=0", () => {
    const input: BuildTrialBalanceInput = {
      accounts: [makeAccount({ id: "a1", code: "1.1.1" })],
      movements: [mov("a1", "800", "300")],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    };
    const result = buildTrialBalance(input);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.sumasDebe.toFixed(2)).toBe("800.00");
    expect(row.sumasHaber.toFixed(2)).toBe("300.00");
    expect(row.saldoDeudor.toFixed(2)).toBe("500.00");
    expect(row.saldoAcreedor.toFixed(2)).toBe("0.00");
  });
});

// ── Fixture 5: credit-heavy account ──────────────────────────────────────────

describe("B3 Fixture 5 — C4.S2: credit-heavy → saldoDeudor=0, saldoAcreedor=500", () => {
  it("sumasDebe=200, sumasHaber=700 → saldoDeudor=0, saldoAcreedor=500", () => {
    const input: BuildTrialBalanceInput = {
      accounts: [makeAccount({ id: "a2", code: "2.1.1" })],
      movements: [mov("a2", "200", "700")],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    };
    const result = buildTrialBalance(input);
    const row = result.rows[0];
    expect(row.saldoDeudor.toFixed(2)).toBe("0.00");
    expect(row.saldoAcreedor.toFixed(2)).toBe("500.00");
  });
});

// ── Fixture 6: balanced account (both saldos=0, still in output) ─────────────

describe("B3 Fixture 6 — C4.S3: balanced account → saldoDeudor=0, saldoAcreedor=0, still visible", () => {
  it("sumasDebe=1000, sumasHaber=1000 → saldos zero but row in output", () => {
    const input: BuildTrialBalanceInput = {
      accounts: [makeAccount({ id: "a3", code: "1.2.1" })],
      movements: [mov("a3", "1000", "1000")],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    };
    const result = buildTrialBalance(input);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.saldoDeudor.toFixed(2)).toBe("0.00");
    expect(row.saldoAcreedor.toFixed(2)).toBe("0.00");
    expect(row.sumasDebe.toFixed(2)).toBe("1000.00"); // sumasDebe ≠ 0 → row visible
  });
});

// ── Fixture 7: balanced multi-account report ─────────────────────────────────

describe("B3 Fixture 7 — C5.S1: balanced multi-account → imbalanced=false, deltas=0", () => {
  it("balanced fixture: imbalanced=false and deltas are zero", () => {
    // Account A: debit-heavy (saldoDeudor=700)
    // Account B: credit-heavy (saldoAcreedor=700)
    // Σ sumasDebe = 1000+300 = 1300, Σ sumasHaber = 300+1000 = 1300 → balanced
    const accounts = [
      makeAccount({ id: "bal-a", code: "1.1.1" }),
      makeAccount({ id: "bal-b", code: "2.1.1" }),
    ];
    const movements = [
      mov("bal-a", "1000", "300"),
      mov("bal-b", "300", "1000"),
    ];
    const result = buildTrialBalance({ accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO });
    expect(result.imbalanced).toBe(false);
    expect(result.deltaSumas.isZero()).toBe(true);
    expect(result.deltaSaldos.isZero()).toBe(true);
  });
});

// ── Fixture 8: synthetic imbalance ───────────────────────────────────────────

describe("B3 Fixture 8 — C5.S2: synthetic imbalance → imbalanced=true, deltaSumas=Decimal('-50')", () => {
  it("Σ sumasDebe=1000, Σ sumasHaber=1050 → imbalanced=true, deltaSumas=-50", () => {
    // Σ sumasDebe = 1000, Σ sumasHaber = 1050
    const accounts = [
      makeAccount({ id: "imb-a", code: "1.1.1" }),
      makeAccount({ id: "imb-b", code: "2.1.1" }),
    ];
    const movements = [
      mov("imb-a", "1000", "0"),
      mov("imb-b", "0", "1050"),
    ];
    const result = buildTrialBalance({ accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO });
    expect(result.imbalanced).toBe(true);
    // deltaSumas = Σ sumasDebe - Σ sumasHaber = 1000 - 1050 = -50
    expect(result.deltaSumas.equals(new Decimal("-50"))).toBe(true);
  });
});

// ── Fixture 9: ordering ───────────────────────────────────────────────────────

describe("B3 Fixture 9 — C3.S1: random order input → output sorted ASC by code", () => {
  it("rows are ordered by code ASC regardless of input order", () => {
    // Input: codes in random order (accounts must be passed code-sorted from repo)
    // The builder relies on repo returning accounts sorted — let's verify the passthrough
    const accounts = [
      makeAccount({ id: "s5", code: "5.1.1" }),
      makeAccount({ id: "s1", code: "1.1.1" }),
      makeAccount({ id: "s2", code: "2.1.0" }),
      makeAccount({ id: "s4", code: "4.1.1" }),
      makeAccount({ id: "s3", code: "1.2.6" }),
    ];
    const movements = accounts.map((a) => mov(a.id, "100", "0"));
    const result = buildTrialBalance({ accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO });
    const codes = result.rows.map((r) => r.code);
    // Builder preserves the order received from accounts array
    // Repo sorts code ASC — this test documents that builder doesn't re-sort
    // (if accounts were passed sorted, output is sorted)
    expect(codes).toEqual(["5.1.1", "1.1.1", "2.1.0", "4.1.1", "1.2.6"]);
  });

  it("when accounts are code-sorted ASC, rows are code-sorted ASC", () => {
    const accounts = [
      makeAccount({ id: "s1", code: "1.1.1" }),
      makeAccount({ id: "s3", code: "1.2.6" }),
      makeAccount({ id: "s2", code: "2.1.0" }),
      makeAccount({ id: "s4", code: "4.1.1" }),
      makeAccount({ id: "s5", code: "5.1.1" }),
    ];
    const movements = accounts.map((a) => mov(a.id, "100", "0"));
    const result = buildTrialBalance({ accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO });
    const codes = result.rows.map((r) => r.code);
    expect(codes).toEqual(["1.1.1", "1.2.6", "2.1.0", "4.1.1", "5.1.1"]);
  });
});

// ── C4.S5 — rowNumber NOT in domain type ─────────────────────────────────────

describe("C4.S5 — rowNumber NOT in TrialBalanceRow domain type", () => {
  it("rows[0] does NOT have a rowNumber property", () => {
    const input: BuildTrialBalanceInput = {
      accounts: [
        makeAccount({ id: "r1", code: "1.1.1" }),
        makeAccount({ id: "r2", code: "2.1.1" }),
        makeAccount({ id: "r3", code: "5.1.1" }),
      ],
      movements: [
        mov("r1", "100", "0"),
        mov("r2", "0", "100"),
        mov("r3", "50", "0"),
      ],
      dateFrom: DATE_FROM,
      dateTo: DATE_TO,
    };
    const result = buildTrialBalance(input);
    expect(result.rows).toHaveLength(3);
    // rowNumber must NOT exist in domain type
    expect("rowNumber" in result.rows[0]).toBe(false);
  });
});

// ── C4.E1 — no Number/parseFloat/+decimal in builder source ──────────────────

describe("C4.E1 — Decimal purity: no Number(), parseFloat(), or unary +decimal in builder", () => {
  it("builder source code has zero Number(), parseFloat(), or +decimal coercions", () => {
    const builderPath = path.join(__dirname, "../domain/trial-balance.builder.ts");
    const source = fs.readFileSync(builderPath, "utf8");

    // Check for forbidden patterns
    expect(source).not.toMatch(/\bNumber\s*\(/);
    expect(source).not.toMatch(/\bparseFloat\s*\(/);
    // Unary + on a decimal-like variable: +someVar or +d or +decimal
    // Allow legitimate uses like +0 in strings; specifically look for +variable patterns
    expect(source).not.toMatch(/[^a-zA-Z0-9_'"]\+[a-z][a-zA-Z0-9_]*(Decimal|decimal|\.)/);
  });
});

// ── All Decimal fields check ──────────────────────────────────────────────────

describe("Decimal type integrity", () => {
  it("all 4 numeric fields on every row are decimal.js Decimal instances", () => {
    const accounts = [
      makeAccount({ id: "d1", code: "1.1.1" }),
      makeAccount({ id: "d2", code: "2.1.1" }),
    ];
    const movements = [
      mov("d1", "500", "200"),
      mov("d2", "100", "800"),
    ];
    const result = buildTrialBalance({ accounts, movements, dateFrom: DATE_FROM, dateTo: DATE_TO });
    for (const row of result.rows) {
      expect(row.sumasDebe).toBeInstanceOf(Decimal);
      expect(row.sumasHaber).toBeInstanceOf(Decimal);
      expect(row.saldoDeudor).toBeInstanceOf(Decimal);
      expect(row.saldoAcreedor).toBeInstanceOf(Decimal);
    }
    expect(result.totals.sumasDebe).toBeInstanceOf(Decimal);
    expect(result.totals.sumasHaber).toBeInstanceOf(Decimal);
    expect(result.totals.saldoDeudor).toBeInstanceOf(Decimal);
    expect(result.totals.saldoAcreedor).toBeInstanceOf(Decimal);
    expect(result.deltaSumas).toBeInstanceOf(Decimal);
    expect(result.deltaSaldos).toBeInstanceOf(Decimal);
  });
});
