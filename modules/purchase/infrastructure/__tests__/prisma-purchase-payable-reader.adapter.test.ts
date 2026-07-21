/**
 * Unit tests for PrismaPurchasePayableReaderAdapter (purchase-pure-read —
 * mirror sale-pure-read pilot).
 *
 * Mocks @/lib/prisma to avoid DB dependency — mirror
 * `modules/sale/infrastructure/__tests__/prisma-sale-receivable-reader.adapter.test.ts`
 * mock pattern. Covers: query shape (tenant-scoped `findFirst` where + nested
 * allocations select ordered by payment.date asc), Decimal→number boundary
 * conversion (port must NOT leak Prisma.Decimal), and null branch.
 *
 * Decimal mocking: `{ toNumber: () => n }` cast — same technique as the sale
 * pilot fakeDecimal (no runtime Decimal value import).
 *
 * RED acceptance failure mode: FAILS pre-implementación por module resolution
 * failure (`PrismaPurchasePayableReaderAdapter` no existe). Post-GREEN: PASSES
 * porque el adapter emite el where {id, organizationId}, la projection nested
 * con orderBy payment.date asc, y convierte amount/paid/balance/allocations
 * amount de Decimal a number en el boundary infrastructure.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountsPayable: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaPurchasePayableReaderAdapter } from "../prisma-purchase-payable-reader.adapter";

const fakeDecimal = (n: number): Prisma.Decimal =>
  ({ toNumber: () => n }) as unknown as Prisma.Decimal;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PrismaPurchasePayableReaderAdapter — findWithAllocations", () => {
  it("scopes the query by organizationId AND payable id with nested allocations ordered by payment.date asc", async () => {
    vi.mocked(prisma.accountsPayable.findFirst).mockResolvedValueOnce(null);

    const adapter = new PrismaPurchasePayableReaderAdapter();
    await adapter.findWithAllocations("org-1", "pay-1");

    expect(prisma.accountsPayable.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.accountsPayable.findFirst).toHaveBeenCalledWith({
      where: { id: "pay-1", organizationId: "org-1" },
      select: {
        id: true,
        amount: true,
        paid: true,
        balance: true,
        status: true,
        dueDate: true,
        allocations: {
          select: {
            id: true,
            paymentId: true,
            amount: true,
            payment: {
              select: { id: true, date: true, description: true },
            },
          },
          orderBy: { payment: { date: "asc" } },
        },
      },
    });
  });

  it("converts Decimal fields (amount/paid/balance + allocation amounts) to plain numbers — no Prisma.Decimal leaks", async () => {
    const paymentDate = new Date("2026-03-15T10:00:00Z");
    vi.mocked(prisma.accountsPayable.findFirst).mockResolvedValueOnce({
      id: "pay-1",
      amount: fakeDecimal(150),
      paid: fakeDecimal(50),
      balance: fakeDecimal(100),
      status: "PARTIAL",
      dueDate: new Date("2026-04-30"),
      allocations: [
        {
          id: "alloc-1",
          paymentId: "pmt-1",
          amount: fakeDecimal(50),
          payment: {
            id: "pmt-1",
            date: paymentDate,
            description: "Pago parcial",
          },
        },
      ],
      // Cast: mock returns the select projection, not the full row.
    } as never);

    const adapter = new PrismaPurchasePayableReaderAdapter();
    const result = await adapter.findWithAllocations("org-1", "pay-1");

    expect(result).toEqual({
      id: "pay-1",
      amount: 150,
      paid: 50,
      balance: 100,
      status: "PARTIAL",
      dueDate: new Date("2026-04-30"),
      allocations: [
        {
          id: "alloc-1",
          paymentId: "pmt-1",
          amount: 50,
          payment: {
            id: "pmt-1",
            date: paymentDate,
            description: "Pago parcial",
          },
        },
      ],
    });
    // Plain numbers, not Decimal-like objects.
    expect(typeof result!.amount).toBe("number");
    expect(typeof result!.allocations[0].amount).toBe("number");
  });

  it("returns null when no payable matches id + organizationId (cross-tenant or missing)", async () => {
    vi.mocked(prisma.accountsPayable.findFirst).mockResolvedValueOnce(null);

    const adapter = new PrismaPurchasePayableReaderAdapter();
    const result = await adapter.findWithAllocations("org-other", "pay-1");

    expect(result).toBeNull();
  });
});
