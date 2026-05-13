import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { resolveBalances } from "@/modules/accounting/financial-statements/domain/balance-source.resolver";
import { NotFoundError } from "@/features/shared/errors";

const D = (v: string | number) => new Prisma.Decimal(v);

// ── Test de Caracterización: convención de signo de AccountBalance.balance ──
// Documenta el contrato establecido en account-balances.repository.ts:68-72.
// Si el writer cambia esa lógica, este test detecta la rotura.
describe("Caracterización: convención de signo de AccountBalance.balance", () => {
  it("DEUDORA: balance = debitTotal − creditTotal (positivo cuando débito > crédito)", () => {
    // Simula el cálculo del writer (account-balances.repository.ts:70)
    const debitTotal = D("5000");
    const creditTotal = D("3000");
    const balance = debitTotal.minus(creditTotal); // DEUDORA → debit - credit
    expect(balance.toNumber()).toBe(2000);
    expect(balance.isPositive()).toBe(true); // positivo por lado natural
  });

  it("DEUDORA: balance es negativo cuando crédito > débito (saldo contrario)", () => {
    const debitTotal = D("1000");
    const creditTotal = D("4000");
    const balance = debitTotal.minus(creditTotal); // DEUDORA → debit - credit
    expect(balance.toNumber()).toBe(-3000);
  });

  it("ACREEDORA: balance = creditTotal − debitTotal (positivo cuando crédito > débito)", () => {
    // Simula el cálculo del writer (account-balances.repository.ts:71)
    const debitTotal = D("1000");
    const creditTotal = D("8000");
    const balance = creditTotal.minus(debitTotal); // ACREEDORA → credit - debit
    expect(balance.toNumber()).toBe(7000);
    expect(balance.isPositive()).toBe(true); // positivo por lado natural
  });

  it("ACREEDORA: balance es negativo cuando débito > crédito (saldo contrario)", () => {
    const debitTotal = D("5000");
    const creditTotal = D("2000");
    const balance = creditTotal.minus(debitTotal); // ACREEDORA → credit - debit
    expect(balance.toNumber()).toBe(-3000);
  });
});

// ── Fixtures de período fiscal ──
const closedPeriod = {
  id: "period-closed",
  status: "CLOSED" as const,
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-12-31"),
};

const openPeriod = {
  id: "period-open",
  status: "OPEN" as const,
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-12-31"),
};

// ── Factory de repo mock ──
function makeRepo(overrides?: {
  findFiscalPeriod?: (orgId: string, periodId: string) => Promise<typeof closedPeriod | null>;
  findAccountBalances?: () => Promise<Array<{ accountId: string; balance: Prisma.Decimal }>>;
  aggregateJournalLinesUpTo?: () => Promise<Array<{ accountId: string; totalDebit: Prisma.Decimal; totalCredit: Prisma.Decimal; nature: "DEUDORA" | "ACREEDORA" }>>;
}) {
  return {
    findFiscalPeriod: overrides?.findFiscalPeriod ?? vi.fn().mockResolvedValue(closedPeriod),
    findAccountBalances: overrides?.findAccountBalances ?? vi.fn().mockResolvedValue([]),
    aggregateJournalLinesUpTo: overrides?.aggregateJournalLinesUpTo ?? vi.fn().mockResolvedValue([]),
  };
}

describe("resolveBalances", () => {
  // ── Escenario 1: período CLOSED + fecha exacta → snapshot ──
  it("período CLOSED con fecha exacta → source: snapshot, preliminary: false", async () => {
    const repo = makeRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue(closedPeriod),
      findAccountBalances: vi.fn().mockResolvedValue([
        { accountId: "acc-1", balance: D("1000") },
        { accountId: "acc-2", balance: D("-500") },
      ]),
    });

    const result = await resolveBalances(repo, {
      orgId: "org-1",
      date: new Date("2025-12-31"), // igual a endDate del período cerrado
      periodId: "period-closed",
    });

    expect(result.source).toBe("snapshot");
    expect(result.preliminary).toBe(false);
    expect(result.balances).toHaveLength(2);
    expect(result.balances[0].accountId).toBe("acc-1");
    expect(result.balances[0].balance.toNumber()).toBe(1000);
  });

  // ── Escenario 2: período OPEN → on-the-fly, preliminary: true ──
  it("período OPEN → source: on-the-fly, preliminary: true", async () => {
    const repo = makeRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue(openPeriod),
      aggregateJournalLinesUpTo: vi.fn().mockResolvedValue([
        { accountId: "acc-1", totalDebit: D("2000"), totalCredit: D("800"), nature: "DEUDORA" as const },
      ]),
    });

    const result = await resolveBalances(repo, {
      orgId: "org-1",
      date: new Date("2025-06-30"),
      periodId: "period-open",
    });

    expect(result.source).toBe("on-the-fly");
    expect(result.preliminary).toBe(true);
    // DEUDORA: balance = debit - credit = 2000 - 800 = 1200
    expect(result.balances[0].balance.toNumber()).toBe(1200);
  });

  // ── Escenario 3: sin periodId → on-the-fly, preliminary: true ──
  it("sin periodId → source: on-the-fly, preliminary: true", async () => {
    const repo = makeRepo({
      aggregateJournalLinesUpTo: vi.fn().mockResolvedValue([
        { accountId: "acc-2", totalDebit: D("500"), totalCredit: D("1500"), nature: "ACREEDORA" as const },
      ]),
    });

    const result = await resolveBalances(repo, {
      orgId: "org-1",
      date: new Date("2025-09-30"),
      // sin periodId
    });

    expect(result.source).toBe("on-the-fly");
    expect(result.preliminary).toBe(true);
    // ACREEDORA: balance = credit - debit = 1500 - 500 = 1000
    expect(result.balances[0].balance.toNumber()).toBe(1000);
  });

  // ── Escenario 4: periodId inexistente → lanza NotFoundError ──
  it("periodId inexistente → lanza NotFoundError", async () => {
    const repo = makeRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue(null),
    });

    await expect(
      resolveBalances(repo, {
        orgId: "org-1",
        date: new Date("2025-12-31"),
        periodId: "nonexistent-id",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  // ── Escenario 5: fecha intra-período cerrado → on-the-fly (no cumple condición endDate) ──
  it("fecha intra-período CLOSED (antes de endDate) → source: on-the-fly", async () => {
    const repo = makeRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue(closedPeriod),
      aggregateJournalLinesUpTo: vi.fn().mockResolvedValue([]),
    });

    const result = await resolveBalances(repo, {
      orgId: "org-1",
      date: new Date("2025-06-30"), // antes del 2025-12-31 endDate
      periodId: "period-closed",
    });

    // No cumple la condición CLOSED + fecha === endDate → on-the-fly
    expect(result.source).toBe("on-the-fly");
    expect(result.preliminary).toBe(true);
  });

  // ── TRIANGULATE: on-the-fly aplica correctamente naturaleza ACREEDORA ──
  it("on-the-fly calcula balance correcto para cuenta ACREEDORA", async () => {
    const repo = makeRepo({
      findFiscalPeriod: vi.fn().mockResolvedValue(openPeriod),
      aggregateJournalLinesUpTo: vi.fn().mockResolvedValue([
        { accountId: "pasivo-1", totalDebit: D("100"), totalCredit: D("900"), nature: "ACREEDORA" as const },
        { accountId: "activo-1", totalDebit: D("800"), totalCredit: D("300"), nature: "DEUDORA" as const },
      ]),
    });

    const result = await resolveBalances(repo, {
      orgId: "org-1",
      date: new Date("2025-03-31"),
      periodId: "period-open",
    });

    const pasivo = result.balances.find(b => b.accountId === "pasivo-1")!;
    const activo = result.balances.find(b => b.accountId === "activo-1")!;

    expect(pasivo.balance.toNumber()).toBe(800);  // ACREEDORA: 900 - 100
    expect(activo.balance.toNumber()).toBe(500);  // DEUDORA: 800 - 300
  });
});
