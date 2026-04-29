import { describe, it, expect } from "vitest";
import { Sale, type SaleProps } from "../sale.entity";
import { SaleDetail } from "../sale-detail.entity";
import { ReceivableSummary } from "../value-objects/receivable-summary";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  SaleNoDetails,
  SaleNotDraft,
  InvalidSaleStatusTransition,
  SaleVoidedImmutable,
} from "../errors/sale-errors";

function buildSaleProps(overrides: Partial<SaleProps> = {}): SaleProps {
  const now = new Date();
  return {
    id: "sale-1",
    organizationId: "org-1",
    status: "DRAFT",
    sequenceNumber: null,
    date: now,
    contactId: "contact-1",
    periodId: "period-1",
    description: "Venta",
    referenceNumber: null,
    notes: null,
    totalAmount: MonetaryAmount.zero(),
    journalEntryId: null,
    receivableId: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    details: [],
    receivable: null,
    ...overrides,
  };
}

function buildDetail(saleId: string, lineAmount: number, order = 0): SaleDetail {
  return SaleDetail.fromPersistence({
    id: `det-${order}`,
    saleId,
    description: `L${order}`,
    lineAmount: MonetaryAmount.of(lineAmount),
    order,
    incomeAccountId: "acc-1",
  });
}

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

  describe("post (DRAFT → POSTED)", () => {
    it("transiciona DRAFT a POSTED y recomputa totalAmount desde details", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "DRAFT",
          totalAmount: MonetaryAmount.zero(),
          details: [
            buildDetail("sale-1", 100, 0),
            buildDetail("sale-1", 50, 1),
          ],
        }),
      );
      const posted = sale.post();
      expect(posted.status).toBe("POSTED");
      expect(posted.totalAmount.value).toBe(150);
    });

    it("retorna nueva instancia sin mutar el original", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "DRAFT",
          details: [buildDetail("sale-1", 100, 0)],
        }),
      );
      const posted = sale.post();
      expect(posted).not.toBe(sale);
      expect(sale.status).toBe("DRAFT");
    });

    it("rechaza post desde DRAFT con 0 details", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({ status: "DRAFT", details: [] }),
      );
      expect(() => sale.post()).toThrow(SaleNoDetails);
    });

    it("rechaza post desde POSTED (transición inválida)", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "POSTED",
          details: [buildDetail("sale-1", 100, 0)],
        }),
      );
      expect(() => sale.post()).toThrow(InvalidSaleStatusTransition);
    });

    it("rechaza post desde VOIDED (terminal)", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "VOIDED",
          details: [buildDetail("sale-1", 100, 0)],
        }),
      );
      expect(() => sale.post()).toThrow(SaleVoidedImmutable);
    });
  });

  describe("void", () => {
    it("transiciona POSTED a VOIDED", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "POSTED" }));
      const voided = sale.void();
      expect(voided.status).toBe("VOIDED");
    });

    it("transiciona LOCKED a VOIDED", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "LOCKED" }));
      const voided = sale.void();
      expect(voided.status).toBe("VOIDED");
    });

    it("rechaza void desde DRAFT", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "DRAFT" }));
      expect(() => sale.void()).toThrow(InvalidSaleStatusTransition);
    });

    it("rechaza void desde VOIDED (terminal)", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "VOIDED" }));
      expect(() => sale.void()).toThrow(SaleVoidedImmutable);
    });
  });

  describe("lock", () => {
    it("transiciona POSTED a LOCKED", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "POSTED" }));
      const locked = sale.lock();
      expect(locked.status).toBe("LOCKED");
    });

    it("rechaza lock desde DRAFT", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "DRAFT" }));
      expect(() => sale.lock()).toThrow(InvalidSaleStatusTransition);
    });

    it("rechaza lock desde LOCKED (no idempotente)", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "LOCKED" }));
      expect(() => sale.lock()).toThrow(InvalidSaleStatusTransition);
    });

    it("rechaza lock desde VOIDED (terminal)", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "VOIDED" }));
      expect(() => sale.lock()).toThrow(SaleVoidedImmutable);
    });
  });

  describe("assertCanDelete", () => {
    it("permite eliminar venta en DRAFT", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "DRAFT" }));
      expect(() => sale.assertCanDelete()).not.toThrow();
    });

    it("rechaza eliminar venta en POSTED", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "POSTED" }));
      expect(() => sale.assertCanDelete()).toThrow(SaleNotDraft);
    });

    it("rechaza eliminar venta en LOCKED", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "LOCKED" }));
      expect(() => sale.assertCanDelete()).toThrow(SaleNotDraft);
    });

    it("rechaza eliminar venta en VOIDED", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "VOIDED" }));
      expect(() => sale.assertCanDelete()).toThrow(SaleNotDraft);
    });
  });

  describe("applyEdit", () => {
    it("actualiza todos los campos editables provistos", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "DRAFT",
          description: "Original",
          contactId: "contact-orig",
        }),
      );
      const newDate = new Date("2026-05-15");
      const edited = sale.applyEdit({
        date: newDate,
        description: "Editado",
        contactId: "contact-new",
        referenceNumber: 100,
        notes: "Nota agregada",
      });
      expect(edited.date).toEqual(newDate);
      expect(edited.description).toBe("Editado");
      expect(edited.contactId).toBe("contact-new");
      expect(edited.referenceNumber).toBe(100);
      expect(edited.notes).toBe("Nota agregada");
    });

    it("actualiza solo los campos provistos (partial input)", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          description: "Original",
          contactId: "contact-orig",
          notes: "Nota original",
        }),
      );
      const edited = sale.applyEdit({ description: "Solo description" });
      expect(edited.description).toBe("Solo description");
      expect(edited.contactId).toBe("contact-orig");
      expect(edited.notes).toBe("Nota original");
    });

    it("permite limpiar referenceNumber y notes con null", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({ referenceNumber: 42, notes: "Tenía nota" }),
      );
      const edited = sale.applyEdit({ referenceNumber: null, notes: null });
      expect(edited.referenceNumber).toBeNull();
      expect(edited.notes).toBeNull();
    });

    it("retorna nueva instancia sin mutar el original", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({ description: "Original" }),
      );
      const edited = sale.applyEdit({ description: "Cambiado" });
      expect(edited).not.toBe(sale);
      expect(sale.description).toBe("Original");
    });

    it("permite edit desde DRAFT, POSTED y LOCKED", () => {
      for (const status of ["DRAFT", "POSTED", "LOCKED"] as const) {
        const sale = Sale.fromPersistence(buildSaleProps({ status }));
        expect(() => sale.applyEdit({ description: "X" })).not.toThrow();
      }
    });

    it("rechaza edit desde VOIDED", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "VOIDED" }));
      expect(() => sale.applyEdit({ description: "X" })).toThrow(
        SaleVoidedImmutable,
      );
    });
  });

  describe("replaceDetails", () => {
    it("reemplaza details y recomputa totalAmount", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "DRAFT",
          details: [buildDetail("sale-1", 100, 0)],
          totalAmount: MonetaryAmount.of(100),
        }),
      );
      const newDetails = [
        buildDetail("sale-1", 50, 0),
        buildDetail("sale-1", 75.5, 1),
      ];
      const updated = sale.replaceDetails(newDetails);
      expect(updated.details).toHaveLength(2);
      expect(updated.totalAmount.value).toBe(125.5);
    });

    it("permite replaceDetails con array vacío en DRAFT", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "DRAFT",
          details: [buildDetail("sale-1", 100, 0)],
        }),
      );
      const updated = sale.replaceDetails([]);
      expect(updated.details).toEqual([]);
      expect(updated.totalAmount.value).toBe(0);
    });

    it("rechaza replaceDetails con array vacío en POSTED", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "POSTED",
          details: [buildDetail("sale-1", 100, 0)],
        }),
      );
      expect(() => sale.replaceDetails([])).toThrow(SaleNoDetails);
    });

    it("rechaza replaceDetails con array vacío en LOCKED", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "LOCKED",
          details: [buildDetail("sale-1", 100, 0)],
        }),
      );
      expect(() => sale.replaceDetails([])).toThrow(SaleNoDetails);
    });

    it("rechaza replaceDetails desde VOIDED", () => {
      const sale = Sale.fromPersistence(buildSaleProps({ status: "VOIDED" }));
      expect(() =>
        sale.replaceDetails([buildDetail("sale-1", 100, 0)]),
      ).toThrow(SaleVoidedImmutable);
    });

    it("retorna nueva instancia sin mutar el original", () => {
      const sale = Sale.fromPersistence(
        buildSaleProps({
          status: "DRAFT",
          details: [buildDetail("sale-1", 100, 0)],
        }),
      );
      const updated = sale.replaceDetails([buildDetail("sale-1", 200, 0)]);
      expect(updated).not.toBe(sale);
      expect(sale.totalAmount.value).toBe(0);
    });
  });
});
