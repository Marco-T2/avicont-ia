import { describe, expect, it } from "vitest";
import { AccountingQueryAdapter } from "../infrastructure/adapters/accounting-query.adapter";
import type { PaymentSummaryDto } from "../domain/ports/accounting-query.port";

// QA Fix #3 — listPayments now resolves contactName via ContactsService.
//
// Marco QA: "cobros del último mes" devolvía "16/05/2026 45fe8f24-... Bs2000"
// con el UUID raw en lugar del nombre del contacto. El adapter ahora hace
// look-up por contactId via ContactsService y propaga `contactName` en el DTO.

describe("QA Fix #3 — AccountingQueryAdapter.listPayments resolves contactName", () => {
  it("populates contactName via ContactsService.getById for each payment", async () => {
    const contactsByCid: Record<string, { id: string; name: string }> = {
      "cid-a": { id: "cid-a", name: "Distribuidora El Sol SRL" },
      "cid-b": { id: "cid-b", name: "Pollos Andinos" },
    };

    const fakePayments = {
      listPaginated: async () => ({
        items: [
          {
            id: "pay-1",
            date: new Date("2026-05-01T00:00:00Z"),
            status: "POSTED" as const,
            method: "EFECTIVO",
            direction: "COBRO" as const,
            contactId: "cid-a",
            amount: { value: "2000.00" },
            description: "Pago de mayo",
          },
          {
            id: "pay-2",
            date: new Date("2026-05-02T00:00:00Z"),
            status: "POSTED" as const,
            method: "TRANSFERENCIA",
            direction: "PAGO" as const,
            contactId: "cid-b",
            amount: { value: "500.00" },
            description: "Compra",
          },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      }),
    };

    const fakeContacts = {
      getById: async (orgId: string, id: string) => {
        const c = contactsByCid[id];
        if (!c) throw new Error("not found");
        return { id: c.id, name: c.name };
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new AccountingQueryAdapter(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      fakePayments as any,
      {} as any,
      fakeContacts as any,
    );

    const result: PaymentSummaryDto[] = await adapter.listPayments("org-1");

    expect(result).toHaveLength(2);
    expect(result[0].contactName).toBe("Distribuidora El Sol SRL");
    expect(result[1].contactName).toBe("Pollos Andinos");
    // contactId still preserved (downstream UI may need it)
    expect(result[0].contactId).toBe("cid-a");
    expect(result[1].contactId).toBe("cid-b");
    // amount still serialized via roundHalfUp(...).toFixed(2)
    expect(result[0].amount).toBe("2000.00");
    expect(result[1].amount).toBe("500.00");
  });

  it("falls back to contactId when contact lookup fails (resilience)", async () => {
    const fakePayments = {
      listPaginated: async () => ({
        items: [
          {
            id: "pay-x",
            date: new Date("2026-05-01T00:00:00Z"),
            status: "POSTED" as const,
            method: "EFECTIVO",
            direction: "COBRO" as const,
            contactId: "cid-deleted",
            amount: { value: "100.00" },
            description: "Cobro huérfano",
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      }),
    };
    const fakeContacts = {
      getById: async () => {
        throw new Error("contact not found");
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new AccountingQueryAdapter(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      fakePayments as any,
      {} as any,
      fakeContacts as any,
    );

    const result = await adapter.listPayments("org-1");
    expect(result).toHaveLength(1);
    // Sin nombre disponible, contactName = contactId (no crashea la query)
    expect(result[0].contactName).toBe("cid-deleted");
  });

  it("bulk-resolves unique contactIds (no duplicate getById calls)", async () => {
    let calls = 0;
    const fakePayments = {
      listPaginated: async () => ({
        items: [
          {
            id: "p1",
            date: new Date("2026-05-01T00:00:00Z"),
            status: "POSTED" as const,
            method: "EFECTIVO",
            direction: "COBRO" as const,
            contactId: "cid-same",
            amount: { value: "10.00" },
            description: "x",
          },
          {
            id: "p2",
            date: new Date("2026-05-02T00:00:00Z"),
            status: "POSTED" as const,
            method: "EFECTIVO",
            direction: "COBRO" as const,
            contactId: "cid-same",
            amount: { value: "20.00" },
            description: "y",
          },
          {
            id: "p3",
            date: new Date("2026-05-03T00:00:00Z"),
            status: "POSTED" as const,
            method: "EFECTIVO",
            direction: "COBRO" as const,
            contactId: "cid-other",
            amount: { value: "30.00" },
            description: "z",
          },
        ],
        total: 3,
        page: 1,
        pageSize: 20,
        pageCount: 1,
      }),
    };
    const fakeContacts = {
      getById: async (_o: string, id: string) => {
        calls += 1;
        return { id, name: id === "cid-same" ? "Recurrente SA" : "Otro" };
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new AccountingQueryAdapter(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      fakePayments as any,
      {} as any,
      fakeContacts as any,
    );

    const result = await adapter.listPayments("org-1");
    expect(result.map((r) => r.contactName)).toEqual([
      "Recurrente SA",
      "Recurrente SA",
      "Otro",
    ]);
    // Solo 2 calls a getById (cid-same dedupe + cid-other)
    expect(calls).toBe(2);
  });
});
