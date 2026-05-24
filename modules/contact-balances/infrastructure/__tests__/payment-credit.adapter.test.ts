import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaPaymentCreditAdapter } from "../prisma-payment-credit.adapter";

/**
 * findActivePaymentsForContact feeds the contact's "saldo a favor" (available
 * credit, via CreditBalance.fromPayments). Only money that actually moved may
 * count — POSTED and LOCKED (posted-then-locked, immutable) payments. A DRAFT
 * has not moved cash, so it must NOT inflate the credit.
 *
 * Bug guarded (draft-credit-leak): a partial-payment draft with a remainder
 * (amount > Σ allocations) was offered as available credit and auto-applied to
 * the next comprobante — the user saw a draft PAGO "affect" the next payment.
 *
 * Constructor-DI: the adapter accepts `db` via constructor, so we inject a fake
 * client with a `payment.findMany` spy and assert the WHERE filter directly.
 */

const dbWith = (findMany: ReturnType<typeof vi.fn>): PrismaClient =>
  ({ payment: { findMany } }) as unknown as PrismaClient;

describe("PrismaPaymentCreditAdapter.findActivePaymentsForContact", () => {
  it("queries only POSTED/LOCKED payments (excludes DRAFT and VOIDED)", async () => {
    const findMany = vi.fn().mockResolvedValueOnce([]);
    const adapter = new PrismaPaymentCreditAdapter(dbWith(findMany));

    await adapter.findActivePaymentsForContact("org-1", "c-1");

    const where = findMany.mock.calls[0]?.[0]?.where;
    expect(where.status).toEqual({ in: ["POSTED", "LOCKED"] });
    expect(where).toMatchObject({ organizationId: "org-1", contactId: "c-1" });
  });
});
