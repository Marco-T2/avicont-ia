/**
 * Unit tests for PrismaSaleContactReaderAdapter (sale-pure-read pilot).
 *
 * Mocks @/lib/prisma to avoid DB dependency — mirror
 * `modules/accounting/infrastructure/__tests__/prisma-accounts.repo.unit.test.ts`
 * mock pattern. Covers: query shape (tenant-scoped `findFirst` where + select
 * projection), clean-view passthrough, and null branch.
 *
 * RED acceptance failure mode: FAILS pre-implementación por module resolution
 * failure (`PrismaSaleContactReaderAdapter` no existe). Post-GREEN: PASSES
 * porque el adapter emite el where {id, organizationId} + select projection y
 * retorna el row (shape ya limpio — no hay Decimal en la projection contact).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { PrismaSaleContactReaderAdapter } from "../prisma-sale-contact-reader.adapter";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PrismaSaleContactReaderAdapter — findById", () => {
  it("scopes the query by organizationId AND contact id (tenant safety) with the exact select projection", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce(null);

    const adapter = new PrismaSaleContactReaderAdapter();
    await adapter.findById("org-1", "contact-1");

    expect(prisma.contact.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: { id: "contact-1", organizationId: "org-1" },
      select: {
        id: true,
        name: true,
        type: true,
        nit: true,
        paymentTermsDays: true,
      },
    });
  });

  it("returns the clean contact view when the row exists", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce({
      id: "contact-1",
      name: "Cliente Uno",
      type: "CLIENTE",
      nit: "12345-6",
      paymentTermsDays: 30,
      // Cast: mock returns the select projection, not the full Contact row.
    } as never);

    const adapter = new PrismaSaleContactReaderAdapter();
    const result = await adapter.findById("org-1", "contact-1");

    expect(result).toEqual({
      id: "contact-1",
      name: "Cliente Uno",
      type: "CLIENTE",
      nit: "12345-6",
      paymentTermsDays: 30,
    });
  });

  it("returns null when no contact matches id + organizationId (cross-tenant or missing)", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValueOnce(null);

    const adapter = new PrismaSaleContactReaderAdapter();
    const result = await adapter.findById("org-other", "contact-1");

    expect(result).toBeNull();
  });
});
