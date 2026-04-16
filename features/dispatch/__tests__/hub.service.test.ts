/**
 * PR1 — Tasks 1.1–1.8 (RED → GREEN): HubService unit tests.
 * PR2-cleanup — Task: Decimal serialization to string at service boundary.
 *
 * Covers REQ-1 (merge), REQ-2 (discriminated union), REQ-3 (type filter),
 * REQ-4 (date filter), REQ-5 (status filter), REQ-6 (sort order).
 * All sub-service deps are mocked — no DB access.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HubService } from "../hub.service";
import type { SaleServiceForHub, DispatchServiceForHub } from "../hub.service";
import type { HubItem } from "../hub.types";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_ID = "org-hub-test";

function makeSale(overrides: Partial<{
  id: string;
  date: Date;
  status: string;
  contactId: string;
  periodId: string;
}> = {}) {
  return {
    id: overrides.id ?? "sale-1",
    displayCode: "V-001",
    referenceNumber: null,
    date: overrides.date ?? new Date("2024-02-15"),
    contactId: overrides.contactId ?? "contact-1",
    contact: { id: overrides.contactId ?? "contact-1", name: "Cliente Test", type: "CLIENTE" },
    periodId: overrides.periodId ?? "period-1",
    description: "Venta test",
    totalAmount: 1000,
    status: overrides.status ?? "DRAFT",
  };
}

function makeDispatch(overrides: Partial<{
  id: string;
  date: Date;
  status: string;
  dispatchType: string;
  contactId: string;
  periodId: string;
}> = {}) {
  return {
    id: overrides.id ?? "dispatch-1",
    displayCode: "ND-001",
    referenceNumber: null,
    date: overrides.date ?? new Date("2024-01-10"),
    contactId: overrides.contactId ?? "contact-1",
    contact: { id: overrides.contactId ?? "contact-1", name: "Cliente Test", type: "CLIENTE" },
    periodId: overrides.periodId ?? "period-1",
    description: "Despacho test",
    dispatchType: overrides.dispatchType ?? "NOTA_DESPACHO",
    totalAmount: 500,
    status: overrides.status ?? "DRAFT",
    details: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("HubService.listHub", () => {
  let saleService: SaleServiceForHub;
  let dispatchService: DispatchServiceForHub;
  let hub: HubService;

  beforeEach(() => {
    saleService = { list: vi.fn().mockResolvedValue([]) };
    dispatchService = { list: vi.fn().mockResolvedValue([]) };
    hub = new HubService(saleService, dispatchService);
  });

  // Task 1.1 — REQ-1: 2 sales + 3 dispatches → 5 items
  it("merges sales and dispatches into a single list", async () => {
    vi.mocked(saleService.list).mockResolvedValue([makeSale({ id: "s1" }), makeSale({ id: "s2" })]);
    vi.mocked(dispatchService.list).mockResolvedValue([
      makeDispatch({ id: "d1" }),
      makeDispatch({ id: "d2" }),
      makeDispatch({ id: "d3" }),
    ]);

    const { items } = await hub.listHub(ORG_ID, {});

    expect(items).toHaveLength(5);
  });

  // Task 1.2 — REQ-1: empty org → []
  it("returns empty array when org has no sales or dispatches", async () => {
    const { items } = await hub.listHub(ORG_ID, {});
    expect(items).toEqual([]);
  });

  // Task 1.3 — REQ-2: every item has source + type in union
  it("every item carries source and type fields from the correct union values", async () => {
    vi.mocked(saleService.list).mockResolvedValue([makeSale()]);
    vi.mocked(dispatchService.list).mockResolvedValue([
      makeDispatch({ dispatchType: "NOTA_DESPACHO" }),
      makeDispatch({ id: "d2", dispatchType: "BOLETA_CERRADA" }),
    ]);

    const { items } = await hub.listHub(ORG_ID, {});

    const sources = items.map((i) => i.source);
    const types = items.map((i) => i.type);

    expect(sources.every((s) => s === "sale" || s === "dispatch")).toBe(true);
    expect(types.every((t) => ["VENTA_GENERAL", "NOTA_DESPACHO", "BOLETA_CERRADA"].includes(t))).toBe(true);
  });

  // Task 1.4 — REQ-3: filters.type = VENTA_GENERAL → only saleService called
  it("calls only saleService when filters.type is VENTA_GENERAL", async () => {
    vi.mocked(saleService.list).mockResolvedValue([makeSale()]);

    await hub.listHub(ORG_ID, { type: "VENTA_GENERAL" });

    expect(saleService.list).toHaveBeenCalledOnce();
    expect(dispatchService.list).not.toHaveBeenCalled();
  });

  // Task 1.5 — REQ-3: filters.type = NOTA_DESPACHO → only dispatchService called
  it("calls only dispatchService when filters.type is NOTA_DESPACHO", async () => {
    vi.mocked(dispatchService.list).mockResolvedValue([makeDispatch()]);

    await hub.listHub(ORG_ID, { type: "NOTA_DESPACHO" });

    expect(dispatchService.list).toHaveBeenCalledOnce();
    expect(saleService.list).not.toHaveBeenCalled();
  });

  // Task 1.6 — REQ-4: dateFrom/dateTo forwarded to both sub-queries
  it("forwards dateFrom and dateTo to both sub-queries", async () => {
    const dateFrom = new Date("2024-01-01");
    const dateTo = new Date("2024-03-31");

    await hub.listHub(ORG_ID, { dateFrom, dateTo });

    expect(saleService.list).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ dateFrom, dateTo }),
    );
    expect(dispatchService.list).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ dateFrom, dateTo }),
    );
  });

  // Task 1.7 — REQ-5: filters.status forwarded to both sub-queries
  it("forwards status filter to both sub-queries", async () => {
    await hub.listHub(ORG_ID, { status: "DRAFT" });

    expect(saleService.list).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ status: "DRAFT" }),
    );
    expect(dispatchService.list).toHaveBeenCalledWith(
      ORG_ID,
      expect.objectContaining({ status: "DRAFT" }),
    );
  });

  // Task 1.8 — REQ-6: sorted date desc, ties broken by id desc
  it("sorts items by date desc with id desc as tiebreaker", async () => {
    vi.mocked(saleService.list).mockResolvedValue([
      makeSale({ id: "s-aaa", date: new Date("2024-01-15") }),
      makeSale({ id: "s-zzz", date: new Date("2024-03-01") }),
    ]);
    vi.mocked(dispatchService.list).mockResolvedValue([
      makeDispatch({ id: "d-mmm", date: new Date("2024-01-15") }),
      makeDispatch({ id: "d-bbb", date: new Date("2024-02-10") }),
    ]);

    const { items } = await hub.listHub(ORG_ID, {});

    expect(items[0].id).toBe("s-zzz"); // 2024-03-01 — latest
    expect(items[1].id).toBe("d-bbb"); // 2024-02-10
    // tie: 2024-01-15 — id desc: "s-aaa" vs "d-mmm" → "s-aaa" > "d-mmm" lexicographically
    expect(items[2].id).toBe("s-aaa");
    expect(items[3].id).toBe("d-mmm");
  });

  // PR2-cleanup — Decimal serialization: totalAmount exposed as string at boundary
  describe("Decimal serialization", () => {
    // Helper that simulates Prisma.Decimal duck-type (has toFixed method)
    function makeDecimal(value: number): { toFixed: (d: number) => string; toString: () => string } {
      return {
        toFixed: (d: number) => value.toFixed(d),
        toString: () => value.toString(),
      };
    }

    it("normalises Prisma.Decimal totalAmount from sale to a 2-decimal string", async () => {
      const decimalAmount = makeDecimal(1234.5);
      vi.mocked(saleService.list).mockResolvedValue([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...makeSale({ id: "s-decimal" }), totalAmount: decimalAmount as any },
      ]);

      const { items } = await hub.listHub(ORG_ID, { type: "VENTA_GENERAL" });

      expect(items[0].totalAmount).toBe("1234.50");
    });

    it("normalises Prisma.Decimal totalAmount from dispatch to a 2-decimal string", async () => {
      const decimalAmount = makeDecimal(999.9);
      vi.mocked(dispatchService.list).mockResolvedValue([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { ...makeDispatch({ id: "d-decimal" }), totalAmount: decimalAmount as any },
      ]);

      const { items } = await hub.listHub(ORG_ID, { type: "NOTA_DESPACHO" });

      expect(items[0].totalAmount).toBe("999.90");
    });

    it("normalises plain number totalAmount to a 2-decimal string", async () => {
      vi.mocked(saleService.list).mockResolvedValue([
        { ...makeSale({ id: "s-plain" }), totalAmount: 500 },
      ]);

      const { items } = await hub.listHub(ORG_ID, { type: "VENTA_GENERAL" });

      expect(items[0].totalAmount).toBe("500.00");
    });
  });
});
