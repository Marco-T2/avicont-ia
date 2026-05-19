/**
 * Tests — fetchShortcutSource helper.
 *
 * Read-only application-layer helper that validates and fetches the source
 * comprobante (sale/purchase) for the "registrar pago" shortcut flow. Returns
 * a discriminated union covering all rejection paths (cross-org, voided,
 * fully-paid, not-found, invalid-params) plus the happy `ok` branch.
 *
 * SDD change: register-payment-shortcut. Phase 1.
 *
 * Mocking: `@/lib/prisma` is mocked via `vi.mock` at module scope (mirrors
 * prisma-accounts.repo.unit.test.ts pattern). Mock functions are declared in
 * `vi.hoisted` so they're available before the mock factory runs.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";

const { mockSaleFindUnique, mockPurchaseFindUnique } = vi.hoisted(() => ({
  mockSaleFindUnique: vi.fn(),
  mockPurchaseFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    sale: { findUnique: mockSaleFindUnique },
    purchase: { findUnique: mockPurchaseFindUnique },
  },
}));

import { fetchShortcutSource } from "../fetch-shortcut-source";

const ORG = "org-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchShortcutSource — happy path COBRO (sale)", () => {
  it("returns ok with source data when sale is POSTED with positive balance", async () => {
    mockSaleFindUnique.mockResolvedValueOnce({
      id: "clxabc123",
      organizationId: ORG,
      status: "POSTED",
      contactId: "cnt-1",
      sequenceNumber: 42,
      referenceNumber: null,
      receivable: {
        id: "rcv-1",
        balance: new Decimal("1000.00"),
      },
    });

    const result = await fetchShortcutSource({
      orgId: ORG,
      type: "COBRO",
      saleId: "clxabc123",
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.source.kind).toBe("sale");
    expect(result.source.id).toBe("clxabc123");
    expect(result.source.contactId).toBe("cnt-1");
    expect(result.source.allocationTargetId).toBe("rcv-1");
    expect(result.source.balance).toBeInstanceOf(Decimal);
    expect(result.source.balance.toString()).toBe("1000");
    expect(result.source.defaultDescription).toBe("Cobro Venta #42");
  });
});
