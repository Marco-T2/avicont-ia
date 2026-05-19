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

describe("fetchShortcutSource — invalid-params type/kind mismatch", () => {
  it("returns invalid-params when type=PAGO is paired with saleId", async () => {
    const result = await fetchShortcutSource({
      orgId: ORG,
      type: "PAGO",
      saleId: "sale-1",
    });

    expect(result.kind).toBe("invalid-params");
    expect(mockSaleFindUnique).not.toHaveBeenCalled();
    expect(mockPurchaseFindUnique).not.toHaveBeenCalled();
  });

  it("returns invalid-params when type=COBRO is paired with purchaseId", async () => {
    const result = await fetchShortcutSource({
      orgId: ORG,
      type: "COBRO",
      purchaseId: "pch-1",
    });

    expect(result.kind).toBe("invalid-params");
    expect(mockSaleFindUnique).not.toHaveBeenCalled();
    expect(mockPurchaseFindUnique).not.toHaveBeenCalled();
  });
});

describe("fetchShortcutSource — invalid-params XOR (saleId vs purchaseId)", () => {
  it("returns invalid-params when both saleId and purchaseId are provided", async () => {
    const result = await fetchShortcutSource({
      orgId: ORG,
      type: "COBRO",
      saleId: "sale-1",
      purchaseId: "pch-1",
    });

    expect(result.kind).toBe("invalid-params");
    // Helper should reject BEFORE hitting Prisma — assert no DB call.
    expect(mockSaleFindUnique).not.toHaveBeenCalled();
    expect(mockPurchaseFindUnique).not.toHaveBeenCalled();
  });

  it("returns invalid-params when neither saleId nor purchaseId is provided", async () => {
    const result = await fetchShortcutSource({
      orgId: ORG,
      type: "COBRO",
    });

    expect(result.kind).toBe("invalid-params");
    expect(mockSaleFindUnique).not.toHaveBeenCalled();
    expect(mockPurchaseFindUnique).not.toHaveBeenCalled();
  });
});

describe("fetchShortcutSource — fully-paid source", () => {
  it("returns fully-paid when receivable.balance is exactly Decimal(0)", async () => {
    mockSaleFindUnique.mockResolvedValueOnce({
      id: "clxabc123",
      organizationId: ORG,
      status: "POSTED",
      contactId: "cnt-1",
      sequenceNumber: 42,
      referenceNumber: null,
      receivable: {
        id: "rcv-1",
        balance: new Decimal("0"),
      },
    });

    const result = await fetchShortcutSource({
      orgId: ORG,
      type: "COBRO",
      saleId: "clxabc123",
    });

    expect(result.kind).toBe("fully-paid");
  });
});

describe("fetchShortcutSource — voided source", () => {
  it("returns voided when sale.status === VOIDED (correct org)", async () => {
    mockSaleFindUnique.mockResolvedValueOnce({
      id: "clxabc123",
      organizationId: ORG,
      status: "VOIDED",
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

    expect(result.kind).toBe("voided");
  });
});

describe("fetchShortcutSource — not-found", () => {
  it("returns not-found when prisma.sale.findUnique resolves to null", async () => {
    mockSaleFindUnique.mockResolvedValueOnce(null);

    const result = await fetchShortcutSource({
      orgId: ORG,
      type: "COBRO",
      saleId: "non-existent",
    });

    expect(result.kind).toBe("not-found");
  });
});

describe("fetchShortcutSource — cross-org rejection", () => {
  it("returns cross-org when sale.organizationId does not match orgId", async () => {
    mockSaleFindUnique.mockResolvedValueOnce({
      id: "clxabc123",
      organizationId: "org-B",
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
      orgId: "org-A",
      type: "COBRO",
      saleId: "clxabc123",
    });

    expect(result.kind).toBe("cross-org");
  });
});
