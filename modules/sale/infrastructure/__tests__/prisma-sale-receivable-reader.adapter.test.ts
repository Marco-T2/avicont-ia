/**
 * Unit tests for PrismaSaleReceivableReaderAdapter (sale-pure-read pilot).
 *
 * Mocks @/lib/prisma to avoid DB dependency — mirror
 * `modules/accounting/infrastructure/__tests__/prisma-accounts.repo.unit.test.ts`
 * mock pattern. Covers: query shape (tenant-scoped `findFirst` where + nested
 * allocations select ordered by payment.date asc), Decimal→number boundary
 * conversion (port must NOT leak Prisma.Decimal), and null branch.
 *
 * Decimal mocking: `{ toNumber: () => n }` cast — same technique as
 * `sale-to-with-details.mapper.test.ts` fakeDecimal (no runtime Decimal
 * value import).
 *
 * RED acceptance failure mode: FAILS pre-implementación por module resolution
 * failure (`PrismaSaleReceivableReaderAdapter` no existe). Post-GREEN: PASSES
 * porque el adapter emite el where {id, organizationId}, la projection nested
 * con orderBy payment.date asc, y convierte amount/paid/balance/allocations
 * amount de Decimal a number en el boundary infrastructure.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    accountsReceivable: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaSaleReceivableReaderAdapter } from "../prisma-sale-receivable-reader.adapter";

const fakeDecimal = (n: number): Prisma.Decimal =>
  ({ toNumber: () => n }) as unknown as Prisma.Decimal;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PrismaSaleReceivableReaderAdapter — findWithAllocations", () => {
  it("scopes the query by organizationId AND receivable id with nested allocations ordered by payment.date asc", async () => {
    vi.mocked(prisma.accountsReceivable.findFirst).mockResolvedValueOnce(null);

    const adapter = new PrismaSaleReceivableReaderAdapter();
    await adapter.findWithAllocations("org-1", "rec-1");

    expect(prisma.accountsReceivable.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.accountsReceivable.findFirst).toHaveBeenCalledWith({
      where: { id: "rec-1", organizationId: "org-1" },
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
    vi.mocked(prisma.accountsReceivable.findFirst).mockResolvedValueOnce({
      id: "rec-1",
      amount: fakeDecimal(150),
      paid: fakeDecimal(50),
      balance: fakeDecimal(100),
      status: "PARTIAL",
      dueDate: new Date("2026-04-30"),
      allocations: [
        {
          id: "alloc-1",
          paymentId: "pay-1",
          amount: fakeDecimal(50),
          payment: {
            id: "pay-1",
            date: paymentDate,
            description: "Pago parcial",
          },
        },
      ],
      // Cast: mock returns the select projection, not the full row.
    } as never);

    const adapter = new PrismaSaleReceivableReaderAdapter();
    const result = await adapter.findWithAllocations("org-1", "rec-1");

    expect(result).toEqual({
      id: "rec-1",
      amount: 150,
      paid: 50,
      balance: 100,
      status: "PARTIAL",
      dueDate: new Date("2026-04-30"),
      allocations: [
        {
          id: "alloc-1",
          paymentId: "pay-1",
          amount: 50,
          payment: {
            id: "pay-1",
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

  it("returns null when no receivable matches id + organizationId (cross-tenant or missing)", async () => {
    vi.mocked(prisma.accountsReceivable.findFirst).mockResolvedValueOnce(null);

    const adapter = new PrismaSaleReceivableReaderAdapter();
    const result = await adapter.findWithAllocations("org-other", "rec-1");

    expect(result).toBeNull();
  });
});
