import { describe, it, expect } from "vitest";
import { Sale } from "../sale.entity";
import { SaleDetail } from "../sale-detail.entity";
import { ReceivableSummary } from "../value-objects/receivable-summary";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

describe("Sale aggregate", () => {
  describe("createDraft", () => {
    it("crea un Sale en DRAFT con id generado y propiedades base", () => {
      const sale = Sale.createDraft({
        organizationId: "org-1",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date("2026-04-29"),
        description: "Venta servicio",
        createdById: "user-1",
        details: [
          {
            description: "Línea 1",
            lineAmount: MonetaryAmount.of(100),
            order: 0,
            incomeAccountId: "acc-1",
          },
        ],
      });
      expect(sale.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(sale.organizationId).toBe("org-1");
      expect(sale.status).toBe("DRAFT");
      expect(sale.contactId).toBe("contact-1");
      expect(sale.periodId).toBe("period-1");
      expect(sale.date).toEqual(new Date("2026-04-29"));
      expect(sale.description).toBe("Venta servicio");
      expect(sale.createdById).toBe("user-1");
      expect(sale.sequenceNumber).toBeNull();
      expect(sale.journalEntryId).toBeNull();
      expect(sale.receivableId).toBeNull();
      expect(sale.referenceNumber).toBeNull();
      expect(sale.notes).toBeNull();
      expect(sale.receivable).toBeNull();
    });

    it("computa totalAmount como suma de details.lineAmount", () => {
      const sale = Sale.createDraft({
        organizationId: "org-1",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "Venta",
        createdById: "user-1",
        details: [
          {
            description: "L1",
            lineAmount: MonetaryAmount.of(100),
            order: 0,
            incomeAccountId: "acc-1",
          },
          {
            description: "L2",
            lineAmount: MonetaryAmount.of(50.5),
            order: 1,
            incomeAccountId: "acc-1",
          },
          {
            description: "L3",
            lineAmount: MonetaryAmount.of(25.25),
            order: 2,
            incomeAccountId: "acc-2",
          },
        ],
      });
      expect(sale.totalAmount.value).toBe(175.75);
    });

    it("acepta 0 details (DRAFT permite vacío) con totalAmount cero", () => {
      const sale = Sale.createDraft({
        organizationId: "org-1",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "Borrador vacío",
        createdById: "user-1",
        details: [],
      });
      expect(sale.details).toEqual([]);
      expect(sale.totalAmount.value).toBe(0);
    });

    it("propaga referenceNumber y notes opcionales cuando se proveen", () => {
      const sale = Sale.createDraft({
        organizationId: "org-1",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "Con extras",
        createdById: "user-1",
        referenceNumber: 42,
        notes: "Nota interna",
        details: [],
      });
      expect(sale.referenceNumber).toBe(42);
      expect(sale.notes).toBe("Nota interna");
    });

    it("construye SaleDetail entities con saleId apuntando al aggregate y order por índice si falta", () => {
      const sale = Sale.createDraft({
        organizationId: "org-1",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "V",
        createdById: "user-1",
        details: [
          {
            description: "A",
            lineAmount: MonetaryAmount.of(10),
            incomeAccountId: "acc-1",
          },
          {
            description: "B",
            lineAmount: MonetaryAmount.of(20),
            incomeAccountId: "acc-1",
          },
        ],
      });
      expect(sale.details).toHaveLength(2);
      for (const d of sale.details) {
        expect(d).toBeInstanceOf(SaleDetail);
        expect(d.saleId).toBe(sale.id);
      }
      expect(sale.details[0]!.order).toBe(0);
      expect(sale.details[1]!.order).toBe(1);
    });

    it("expone details como copia defensiva", () => {
      const sale = Sale.createDraft({
        organizationId: "org-1",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "V",
        createdById: "user-1",
        details: [
          {
            description: "A",
            lineAmount: MonetaryAmount.of(10),
            incomeAccountId: "acc-1",
            order: 0,
          },
        ],
      });
      const exposed = sale.details;
      exposed.pop();
      expect(sale.details).toHaveLength(1);
    });
  });

  describe("fromPersistence", () => {
    it("hidrata preservando id, status y campos", () => {
      const detail = SaleDetail.fromPersistence({
        id: "det-1",
        saleId: "sale-1",
        description: "Det",
        lineAmount: MonetaryAmount.of(100),
        order: 0,
        incomeAccountId: "acc-1",
      });
      const sale = Sale.fromPersistence({
        id: "sale-1",
        organizationId: "org-1",
        status: "POSTED",
        sequenceNumber: 7,
        date: new Date("2026-04-01"),
        contactId: "contact-1",
        periodId: "period-1",
        description: "Persistida",
        referenceNumber: 99,
        notes: null,
        totalAmount: MonetaryAmount.of(100),
        journalEntryId: "je-1",
        receivableId: "rcv-1",
        createdById: "user-1",
        createdAt: new Date("2026-04-01"),
        updatedAt: new Date("2026-04-02"),
        details: [detail],
        receivable: null,
      });
      expect(sale.id).toBe("sale-1");
      expect(sale.status).toBe("POSTED");
      expect(sale.sequenceNumber).toBe(7);
      expect(sale.journalEntryId).toBe("je-1");
      expect(sale.receivableId).toBe("rcv-1");
      expect(sale.totalAmount.value).toBe(100);
      expect(sale.details).toHaveLength(1);
    });

    it("hidrata con receivable adjunto", () => {
      const receivable = ReceivableSummary.fromPersistence({
        id: "rcv-1",
        amount: MonetaryAmount.of(500),
        paid: MonetaryAmount.zero(),
        balance: MonetaryAmount.of(500),
        status: "PENDING",
        dueDate: new Date("2026-05-01"),
        allocations: [],
      });
      const sale = Sale.fromPersistence({
        id: "sale-1",
        organizationId: "org-1",
        status: "POSTED",
        sequenceNumber: 1,
        date: new Date(),
        contactId: "contact-1",
        periodId: "period-1",
        description: "V",
        referenceNumber: null,
        notes: null,
        totalAmount: MonetaryAmount.of(500),
        journalEntryId: "je-1",
        receivableId: "rcv-1",
        createdById: "user-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        details: [],
        receivable,
      });
      expect(sale.receivable?.id).toBe("rcv-1");
      expect(sale.receivable?.balance.value).toBe(500);
    });
  });
});
