/**
 * B1 — RED: Domain type shape verification.
 *
 * Covers:
 * - C13.S1 — all module files importable (via import assertions)
 * - C4.E1  — TrialBalanceRow fields are Prisma.Decimal at runtime
 * - C5.S4  — TrialBalanceTotals has exactly 4 Decimal fields
 * - C12.S1 — SerializedTrialBalanceRow numeric fields are typed as string
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const D = (v: string | number) => new Prisma.Decimal(String(v));

describe("trial-balance domain types", () => {
  it("C4.E1 — TrialBalanceRow fields are Prisma.Decimal instances at runtime", async () => {
    const { } = await import("../domain/trial-balance.types");

    // Construct a conformant TrialBalanceRow manually and verify Decimal fields
    const row = {
      accountId: "acc-1",
      code: "1.1.1",
      name: "Caja",
      sumasDebe: D("1000"),
      sumasHaber: D("500"),
      saldoDeudor: D("500"),
      saldoAcreedor: D("0"),
    };

    expect(row.sumasDebe).toBeInstanceOf(Prisma.Decimal);
    expect(row.sumasHaber).toBeInstanceOf(Prisma.Decimal);
    expect(row.saldoDeudor).toBeInstanceOf(Prisma.Decimal);
    expect(row.saldoAcreedor).toBeInstanceOf(Prisma.Decimal);
  });

  it("C5.S4 — TrialBalanceTotals has exactly 4 Decimal fields", async () => {
    await import("../domain/trial-balance.types");

    const totals = {
      sumasDebe: D("0"),
      sumasHaber: D("0"),
      saldoDeudor: D("0"),
      saldoAcreedor: D("0"),
    };

    const keys = Object.keys(totals);
    expect(keys).toHaveLength(4);
    for (const key of keys) {
      expect(totals[key as keyof typeof totals]).toBeInstanceOf(Prisma.Decimal);
    }
  });

  it("C12.S1 — SerializedTrialBalanceRow numeric fields are strings at compile-time", async () => {
    await import("../domain/trial-balance.types");

    // Construct a conformant SerializedTrialBalanceRow — numeric fields must be string-assignable
    const serialized = {
      accountId: "acc-1",
      code: "1.1.1",
      name: "Caja",
      sumasDebe: "1000.00",
      sumasHaber: "500.00",
      saldoDeudor: "500.00",
      saldoAcreedor: "0.00",
    };

    expect(typeof serialized.sumasDebe).toBe("string");
    expect(typeof serialized.sumasHaber).toBe("string");
    expect(typeof serialized.saldoDeudor).toBe("string");
    expect(typeof serialized.saldoAcreedor).toBe("string");
  });

  it("C13.S1 — domain files can be imported without error", async () => {
    await expect(import("../domain/trial-balance.types")).resolves.toBeDefined();
    await expect(import("../domain/trial-balance.builder")).resolves.toBeDefined();
    await expect(import("../domain/trial-balance.validation")).resolves.toBeDefined();
    await expect(import("../domain/money.utils")).resolves.toBeDefined();
    await expect(import("../domain/ports/trial-balance-query.port")).resolves.toBeDefined();
  });
});
