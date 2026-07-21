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
 * DI (D4, [PRISMA] cluster paydown): the helper no longer imports
 * `@/lib/prisma` — it depends on the injected `ShortcutSourceQueryPort`
 * (domain/ports/shortcut-source-query.port.ts). This suite builds a fake
 * port (`vi.fn()` per method) and passes it as `deps.query`, mirroring the
 * DI style rather than mocking a module. `balance` on the fake port's
 * responses is a `string` (matching the port contract — the adapter does the
 * `Prisma.Decimal → string` conversion, not exercised here).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";

import { fetchShortcutSource } from "../fetch-shortcut-source";

const ORG = "org-1";

const mockFindSaleWithReceivable = vi.fn();
const mockFindPurchaseWithPayable = vi.fn();

const query = {
  findSaleWithReceivable: mockFindSaleWithReceivable,
  findPurchaseWithPayable: mockFindPurchaseWithPayable,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fetchShortcutSource — happy path COBRO (sale)", () => {
  it("returns ok with source data when sale is POSTED with positive balance", async () => {
    mockFindSaleWithReceivable.mockResolvedValueOnce({
      id: "clxabc123",
      organizationId: ORG,
      status: "POSTED",
      contactId: "cnt-1",
      sequenceNumber: 42,
      referenceNumber: null,
      receivable: {
        id: "rcv-1",
        balance: "1000.00",
      },
    });

    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "COBRO",
        saleId: "clxabc123",
      },
      { query },
    );

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

describe("fetchShortcutSource — happy path PAGO (purchase)", () => {
  it("returns ok with source data when purchase is POSTED with positive balance", async () => {
    mockFindPurchaseWithPayable.mockResolvedValueOnce({
      id: "clxpqr456",
      organizationId: ORG,
      status: "POSTED",
      contactId: "cnt-9",
      sequenceNumber: 7,
      referenceNumber: null,
      payable: {
        id: "pay-1",
        balance: "500.00",
      },
    });

    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "PAGO",
        purchaseId: "clxpqr456",
      },
      { query },
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.source.kind).toBe("purchase");
    expect(result.source.id).toBe("clxpqr456");
    expect(result.source.contactId).toBe("cnt-9");
    expect(result.source.allocationTargetId).toBe("pay-1");
    expect(result.source.balance).toBeInstanceOf(Decimal);
    expect(result.source.balance.toString()).toBe("500");
    expect(result.source.defaultDescription).toBe("Pago Compra #7");
    // Did not touch the sale query.
    expect(mockFindSaleWithReceivable).not.toHaveBeenCalled();
  });
});

describe("fetchShortcutSource — invalid-params type/kind mismatch", () => {
  it("returns invalid-params when type=PAGO is paired with saleId", async () => {
    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "PAGO",
        saleId: "sale-1",
      },
      { query },
    );

    expect(result.kind).toBe("invalid-params");
    expect(mockFindSaleWithReceivable).not.toHaveBeenCalled();
    expect(mockFindPurchaseWithPayable).not.toHaveBeenCalled();
  });

  it("returns invalid-params when type=COBRO is paired with purchaseId", async () => {
    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "COBRO",
        purchaseId: "pch-1",
      },
      { query },
    );

    expect(result.kind).toBe("invalid-params");
    expect(mockFindSaleWithReceivable).not.toHaveBeenCalled();
    expect(mockFindPurchaseWithPayable).not.toHaveBeenCalled();
  });
});

describe("fetchShortcutSource — invalid-params XOR (saleId vs purchaseId)", () => {
  it("returns invalid-params when both saleId and purchaseId are provided", async () => {
    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "COBRO",
        saleId: "sale-1",
        purchaseId: "pch-1",
      },
      { query },
    );

    expect(result.kind).toBe("invalid-params");
    // Helper should reject BEFORE hitting the port — assert no query call.
    expect(mockFindSaleWithReceivable).not.toHaveBeenCalled();
    expect(mockFindPurchaseWithPayable).not.toHaveBeenCalled();
  });

  it("returns invalid-params when neither saleId nor purchaseId is provided", async () => {
    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "COBRO",
      },
      { query },
    );

    expect(result.kind).toBe("invalid-params");
    expect(mockFindSaleWithReceivable).not.toHaveBeenCalled();
    expect(mockFindPurchaseWithPayable).not.toHaveBeenCalled();
  });
});

describe("fetchShortcutSource — fully-paid source", () => {
  it("returns fully-paid when receivable.balance is exactly Decimal(0)", async () => {
    mockFindSaleWithReceivable.mockResolvedValueOnce({
      id: "clxabc123",
      organizationId: ORG,
      status: "POSTED",
      contactId: "cnt-1",
      sequenceNumber: 42,
      referenceNumber: null,
      receivable: {
        id: "rcv-1",
        balance: "0",
      },
    });

    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "COBRO",
        saleId: "clxabc123",
      },
      { query },
    );

    expect(result.kind).toBe("fully-paid");
  });
});

describe("fetchShortcutSource — voided source", () => {
  it("returns voided when sale.status === VOIDED (correct org)", async () => {
    mockFindSaleWithReceivable.mockResolvedValueOnce({
      id: "clxabc123",
      organizationId: ORG,
      status: "VOIDED",
      contactId: "cnt-1",
      sequenceNumber: 42,
      referenceNumber: null,
      receivable: {
        id: "rcv-1",
        balance: "1000.00",
      },
    });

    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "COBRO",
        saleId: "clxabc123",
      },
      { query },
    );

    expect(result.kind).toBe("voided");
  });
});

describe("fetchShortcutSource — not-found", () => {
  it("returns not-found when the port resolves to null", async () => {
    mockFindSaleWithReceivable.mockResolvedValueOnce(null);

    const result = await fetchShortcutSource(
      {
        orgId: ORG,
        type: "COBRO",
        saleId: "non-existent",
      },
      { query },
    );

    expect(result.kind).toBe("not-found");
  });
});

describe("fetchShortcutSource — cross-org rejection", () => {
  it("returns cross-org when sale.organizationId does not match orgId", async () => {
    mockFindSaleWithReceivable.mockResolvedValueOnce({
      id: "clxabc123",
      organizationId: "org-B",
      status: "POSTED",
      contactId: "cnt-1",
      sequenceNumber: 42,
      referenceNumber: null,
      receivable: {
        id: "rcv-1",
        balance: "1000.00",
      },
    });

    const result = await fetchShortcutSource(
      {
        orgId: "org-A",
        type: "COBRO",
        saleId: "clxabc123",
      },
      { query },
    );

    expect(result.kind).toBe("cross-org");
  });
});
