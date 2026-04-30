import { describe, it, expect } from "vitest";
import { Purchase, type PurchaseProps } from "../purchase.entity";
import { PurchaseDetail } from "../purchase-detail.entity";
import { PayableSummary } from "../value-objects/payable-summary";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  PurchaseNoDetails,
  PurchaseNotDraft,
  InvalidPurchaseStatusTransition,
  PurchaseVoidedImmutable,
  PurchaseExpenseAccountsRequired,
} from "../errors/purchase-errors";

function buildPurchaseProps(overrides: Partial<PurchaseProps> = {}): PurchaseProps {
  const now = new Date();
  return {
    id: "purchase-1",
    organizationId: "org-1",
    purchaseType: "SERVICIO",
    status: "DRAFT",
    sequenceNumber: null,
    date: now,
    contactId: "contact-1",
    periodId: "period-1",
    description: "Compra",
    referenceNumber: null,
    notes: null,
    totalAmount: MonetaryAmount.zero(),
    ruta: null,
    farmOrigin: null,
    chickenCount: null,
    shrinkagePct: null,
    totalGrossKg: null,
    totalNetKg: null,
    totalShrinkKg: null,
    totalShortageKg: null,
    totalRealNetKg: null,
    journalEntryId: null,
    payableId: null,
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    details: [],
    payable: null,
    ...overrides,
  };
}

function buildDetail(
  purchaseId: string,
  lineAmount: number,
  order = 0,
  expenseAccountId: string | null = "acc-expense",
): PurchaseDetail {
  return PurchaseDetail.fromPersistence({
    id: `det-${order}`,
    purchaseId,
    description: `L${order}`,
    lineAmount: MonetaryAmount.of(lineAmount),
    order,
    expenseAccountId: expenseAccountId === null ? undefined : expenseAccountId,
  });
}

describe("Purchase aggregate", () => {
  describe("createDraft", () => {
    it("crea un Purchase en DRAFT con id generado y propiedades base", () => {
      const purchase = Purchase.createDraft({
        organizationId: "org-1",
        purchaseType: "SERVICIO",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date("2026-04-29"),
        description: "Compra servicio",
        createdById: "user-1",
        details: [
          {
            description: "Línea 1",
            lineAmount: MonetaryAmount.of(100),
            order: 0,
            expenseAccountId: "acc-expense",
          },
        ],
      });
      expect(purchase.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(purchase.organizationId).toBe("org-1");
      expect(purchase.purchaseType).toBe("SERVICIO");
      expect(purchase.status).toBe("DRAFT");
      expect(purchase.contactId).toBe("contact-1");
      expect(purchase.periodId).toBe("period-1");
      expect(purchase.date).toEqual(new Date("2026-04-29"));
      expect(purchase.description).toBe("Compra servicio");
      expect(purchase.createdById).toBe("user-1");
      expect(purchase.sequenceNumber).toBeNull();
      expect(purchase.journalEntryId).toBeNull();
      expect(purchase.payableId).toBeNull();
      expect(purchase.referenceNumber).toBeNull();
      expect(purchase.notes).toBeNull();
      expect(purchase.payable).toBeNull();
    });

    it("computa totalAmount como suma de details.lineAmount", () => {
      const purchase = Purchase.createDraft({
        organizationId: "org-1",
        purchaseType: "SERVICIO",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "Compra",
        createdById: "user-1",
        details: [
          { description: "L1", lineAmount: MonetaryAmount.of(100), order: 0, expenseAccountId: "acc-1" },
          { description: "L2", lineAmount: MonetaryAmount.of(50.5), order: 1, expenseAccountId: "acc-1" },
          { description: "L3", lineAmount: MonetaryAmount.of(25.25), order: 2, expenseAccountId: "acc-2" },
        ],
      });
      expect(purchase.totalAmount.value).toBe(175.75);
    });

    it("acepta 0 details (DRAFT permite vacío) con totalAmount cero", () => {
      const purchase = Purchase.createDraft({
        organizationId: "org-1",
        purchaseType: "SERVICIO",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "Borrador vacío",
        createdById: "user-1",
        details: [],
      });
      expect(purchase.details).toEqual([]);
      expect(purchase.totalAmount.value).toBe(0);
    });

    it("propaga referenceNumber y notes opcionales cuando se proveen", () => {
      const purchase = Purchase.createDraft({
        organizationId: "org-1",
        purchaseType: "SERVICIO",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "Con extras",
        createdById: "user-1",
        referenceNumber: 42,
        notes: "Nota interna",
        details: [],
      });
      expect(purchase.referenceNumber).toBe(42);
      expect(purchase.notes).toBe("Nota interna");
    });

    it("propaga polymorphic header FLETE (ruta) cuando aplica", () => {
      const purchase = Purchase.createDraft({
        organizationId: "org-1",
        purchaseType: "FLETE",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "Flete",
        createdById: "user-1",
        ruta: "L-100",
        details: [],
      });
      expect(purchase.purchaseType).toBe("FLETE");
      expect(purchase.ruta).toBe("L-100");
      expect(purchase.farmOrigin).toBeNull();
    });

    it("propaga polymorphic header POLLO_FAENADO (farmOrigin/chickenCount/shrinkagePct) + totalKg cuando se proveen", () => {
      const purchase = Purchase.createDraft({
        organizationId: "org-1",
        purchaseType: "POLLO_FAENADO",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "Faena",
        createdById: "user-1",
        farmOrigin: "Granja A",
        chickenCount: 1500,
        shrinkagePct: 2.5,
        totalGrossKg: 105.5,
        totalNetKg: 100.5,
        totalShrinkKg: 0.5,
        totalShortageKg: 0,
        totalRealNetKg: 100.0,
        details: [],
      });
      expect(purchase.farmOrigin).toBe("Granja A");
      expect(purchase.chickenCount).toBe(1500);
      expect(purchase.shrinkagePct).toBe(2.5);
      expect(purchase.totalGrossKg).toBe(105.5);
      expect(purchase.totalNetKg).toBe(100.5);
      expect(purchase.totalShrinkKg).toBe(0.5);
      expect(purchase.totalShortageKg).toBe(0);
      expect(purchase.totalRealNetKg).toBe(100.0);
    });

    it("construye PurchaseDetail entities con purchaseId apuntando al aggregate y order por índice si falta", () => {
      const purchase = Purchase.createDraft({
        organizationId: "org-1",
        purchaseType: "SERVICIO",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "C",
        createdById: "user-1",
        details: [
          { description: "A", lineAmount: MonetaryAmount.of(10), expenseAccountId: "acc-1" },
          { description: "B", lineAmount: MonetaryAmount.of(20), expenseAccountId: "acc-1" },
        ],
      });
      expect(purchase.details).toHaveLength(2);
      for (const d of purchase.details) {
        expect(d).toBeInstanceOf(PurchaseDetail);
        expect(d.purchaseId).toBe(purchase.id);
      }
      expect(purchase.details[0]!.order).toBe(0);
      expect(purchase.details[1]!.order).toBe(1);
    });

    it("expone details como copia defensiva", () => {
      const purchase = Purchase.createDraft({
        organizationId: "org-1",
        purchaseType: "SERVICIO",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date(),
        description: "C",
        createdById: "user-1",
        details: [
          { description: "A", lineAmount: MonetaryAmount.of(10), order: 0, expenseAccountId: "acc-1" },
        ],
      });
      const exposed = purchase.details;
      exposed.pop();
      expect(purchase.details).toHaveLength(1);
    });

    it("rechaza createDraft si COMPRA_GENERAL tiene detail sin expenseAccountId", () => {
      expect(() =>
        Purchase.createDraft({
          organizationId: "org-1",
          purchaseType: "COMPRA_GENERAL",
          contactId: "contact-1",
          periodId: "period-1",
          date: new Date(),
          description: "Compra general",
          createdById: "user-1",
          details: [
            { description: "L1", lineAmount: MonetaryAmount.of(100), order: 0, expenseAccountId: "acc-1" },
            { description: "L2", lineAmount: MonetaryAmount.of(50), order: 1 },
          ],
        }),
      ).toThrow(PurchaseExpenseAccountsRequired);
    });

    it("rechaza createDraft si SERVICIO tiene detail sin expenseAccountId", () => {
      expect(() =>
        Purchase.createDraft({
          organizationId: "org-1",
          purchaseType: "SERVICIO",
          contactId: "contact-1",
          periodId: "period-1",
          date: new Date(),
          description: "Servicio",
          createdById: "user-1",
          details: [
            { description: "L1", lineAmount: MonetaryAmount.of(100), order: 0 },
          ],
        }),
      ).toThrow(PurchaseExpenseAccountsRequired);
    });

    it("permite createDraft FLETE sin expenseAccountId per detail", () => {
      expect(() =>
        Purchase.createDraft({
          organizationId: "org-1",
          purchaseType: "FLETE",
          contactId: "contact-1",
          periodId: "period-1",
          date: new Date(),
          description: "Flete",
          createdById: "user-1",
          details: [
            { description: "L1", lineAmount: MonetaryAmount.of(100), order: 0 },
          ],
        }),
      ).not.toThrow();
    });

    it("permite createDraft POLLO_FAENADO sin expenseAccountId per detail", () => {
      expect(() =>
        Purchase.createDraft({
          organizationId: "org-1",
          purchaseType: "POLLO_FAENADO",
          contactId: "contact-1",
          periodId: "period-1",
          date: new Date(),
          description: "Faena",
          createdById: "user-1",
          details: [
            { description: "L1", lineAmount: MonetaryAmount.of(100), order: 0 },
          ],
        }),
      ).not.toThrow();
    });
  });

  describe("fromPersistence", () => {
    it("hidrata preservando id, status y campos", () => {
      const detail = PurchaseDetail.fromPersistence({
        id: "det-1",
        purchaseId: "purchase-1",
        description: "Det",
        lineAmount: MonetaryAmount.of(100),
        order: 0,
        expenseAccountId: "acc-1",
      });
      const purchase = Purchase.fromPersistence({
        id: "purchase-1",
        organizationId: "org-1",
        purchaseType: "SERVICIO",
        status: "POSTED",
        sequenceNumber: 7,
        date: new Date("2026-04-01"),
        contactId: "contact-1",
        periodId: "period-1",
        description: "Persistida",
        referenceNumber: 99,
        notes: null,
        totalAmount: MonetaryAmount.of(100),
        ruta: null,
        farmOrigin: null,
        chickenCount: null,
        shrinkagePct: null,
        totalGrossKg: null,
        totalNetKg: null,
        totalShrinkKg: null,
        totalShortageKg: null,
        totalRealNetKg: null,
        journalEntryId: "je-1",
        payableId: "pay-1",
        createdById: "user-1",
        createdAt: new Date("2026-04-01"),
        updatedAt: new Date("2026-04-02"),
        details: [detail],
        payable: null,
      });
      expect(purchase.id).toBe("purchase-1");
      expect(purchase.status).toBe("POSTED");
      expect(purchase.sequenceNumber).toBe(7);
      expect(purchase.journalEntryId).toBe("je-1");
      expect(purchase.payableId).toBe("pay-1");
      expect(purchase.totalAmount.value).toBe(100);
      expect(purchase.details).toHaveLength(1);
    });

    it("hidrata con payable adjunto", () => {
      const payable = PayableSummary.fromPersistence({
        id: "pay-1",
        amount: MonetaryAmount.of(500),
        paid: MonetaryAmount.zero(),
        balance: MonetaryAmount.of(500),
        status: "PENDING",
        dueDate: new Date("2026-05-01"),
        allocations: [],
      });
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "POSTED",
          payableId: "pay-1",
          payable,
          totalAmount: MonetaryAmount.of(500),
        }),
      );
      expect(purchase.payable?.id).toBe("pay-1");
      expect(purchase.payable?.balance.value).toBe(500);
    });

    it("hidrata POLLO_FAENADO con totalKg fields", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          purchaseType: "POLLO_FAENADO",
          farmOrigin: "Granja B",
          chickenCount: 2000,
          shrinkagePct: 3.0,
          totalGrossKg: 200,
          totalNetKg: 194,
          totalShrinkKg: 6,
          totalShortageKg: 0,
          totalRealNetKg: 194,
        }),
      );
      expect(purchase.purchaseType).toBe("POLLO_FAENADO");
      expect(purchase.totalGrossKg).toBe(200);
      expect(purchase.totalNetKg).toBe(194);
    });
  });

  describe("post (DRAFT → POSTED)", () => {
    it("transiciona DRAFT a POSTED y recomputa totalAmount desde details", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          totalAmount: MonetaryAmount.zero(),
          details: [
            buildDetail("purchase-1", 100, 0),
            buildDetail("purchase-1", 50, 1),
          ],
        }),
      );
      const posted = purchase.post();
      expect(posted.status).toBe("POSTED");
      expect(posted.totalAmount.value).toBe(150);
    });

    it("retorna nueva instancia sin mutar el original", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          details: [buildDetail("purchase-1", 100, 0)],
        }),
      );
      const posted = purchase.post();
      expect(posted).not.toBe(purchase);
      expect(purchase.status).toBe("DRAFT");
    });

    it("rechaza post desde DRAFT con 0 details", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({ status: "DRAFT", details: [] }),
      );
      expect(() => purchase.post()).toThrow(PurchaseNoDetails);
    });

    it("rechaza post desde POSTED (transición inválida)", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "POSTED",
          details: [buildDetail("purchase-1", 100, 0)],
        }),
      );
      expect(() => purchase.post()).toThrow(InvalidPurchaseStatusTransition);
    });

    it("rechaza post desde VOIDED (terminal)", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "VOIDED",
          details: [buildDetail("purchase-1", 100, 0)],
        }),
      );
      expect(() => purchase.post()).toThrow(PurchaseVoidedImmutable);
    });

    it("rechaza post si COMPRA_GENERAL tiene detail sin expenseAccountId", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          purchaseType: "COMPRA_GENERAL",
          details: [
            buildDetail("purchase-1", 100, 0, "acc-1"),
            buildDetail("purchase-1", 50, 1, null),
          ],
        }),
      );
      expect(() => purchase.post()).toThrow(PurchaseExpenseAccountsRequired);
    });

    it("rechaza post si SERVICIO tiene detail sin expenseAccountId", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          purchaseType: "SERVICIO",
          details: [buildDetail("purchase-1", 100, 0, null)],
        }),
      );
      expect(() => purchase.post()).toThrow(PurchaseExpenseAccountsRequired);
    });

    it("permite post FLETE sin expenseAccountId per detail", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          purchaseType: "FLETE",
          details: [buildDetail("purchase-1", 100, 0, null)],
        }),
      );
      expect(() => purchase.post()).not.toThrow();
    });

    it("permite post POLLO_FAENADO sin expenseAccountId per detail", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          purchaseType: "POLLO_FAENADO",
          details: [buildDetail("purchase-1", 100, 0, null)],
        }),
      );
      expect(() => purchase.post()).not.toThrow();
    });
  });

  describe("void", () => {
    it("transiciona POSTED a VOIDED", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "POSTED" }));
      const voided = purchase.void();
      expect(voided.status).toBe("VOIDED");
    });

    it("transiciona LOCKED a VOIDED", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "LOCKED" }));
      const voided = purchase.void();
      expect(voided.status).toBe("VOIDED");
    });

    it("rechaza void desde DRAFT", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "DRAFT" }));
      expect(() => purchase.void()).toThrow(InvalidPurchaseStatusTransition);
    });

    it("rechaza void desde VOIDED (terminal)", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "VOIDED" }));
      expect(() => purchase.void()).toThrow(PurchaseVoidedImmutable);
    });
  });

  describe("lock", () => {
    it("transiciona POSTED a LOCKED", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "POSTED" }));
      const locked = purchase.lock();
      expect(locked.status).toBe("LOCKED");
    });

    it("rechaza lock desde DRAFT", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "DRAFT" }));
      expect(() => purchase.lock()).toThrow(InvalidPurchaseStatusTransition);
    });

    it("rechaza lock desde LOCKED (no idempotente)", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "LOCKED" }));
      expect(() => purchase.lock()).toThrow(InvalidPurchaseStatusTransition);
    });

    it("rechaza lock desde VOIDED (terminal)", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "VOIDED" }));
      expect(() => purchase.lock()).toThrow(PurchaseVoidedImmutable);
    });
  });

  describe("assertCanDelete", () => {
    it("permite eliminar compra en DRAFT", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "DRAFT" }));
      expect(() => purchase.assertCanDelete()).not.toThrow();
    });

    it("rechaza eliminar compra en POSTED", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "POSTED" }));
      expect(() => purchase.assertCanDelete()).toThrow(PurchaseNotDraft);
    });

    it("rechaza eliminar compra en LOCKED", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "LOCKED" }));
      expect(() => purchase.assertCanDelete()).toThrow(PurchaseNotDraft);
    });

    it("rechaza eliminar compra en VOIDED", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "VOIDED" }));
      expect(() => purchase.assertCanDelete()).toThrow(PurchaseNotDraft);
    });
  });

  describe("applyEdit", () => {
    it("actualiza todos los campos editables provistos", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          description: "Original",
          contactId: "contact-orig",
        }),
      );
      const newDate = new Date("2026-05-15");
      const edited = purchase.applyEdit({
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
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          description: "Original",
          contactId: "contact-orig",
          notes: "Nota original",
        }),
      );
      const edited = purchase.applyEdit({ description: "Solo description" });
      expect(edited.description).toBe("Solo description");
      expect(edited.contactId).toBe("contact-orig");
      expect(edited.notes).toBe("Nota original");
    });

    it("permite limpiar referenceNumber y notes con null", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({ referenceNumber: 42, notes: "Tenía nota" }),
      );
      const edited = purchase.applyEdit({ referenceNumber: null, notes: null });
      expect(edited.referenceNumber).toBeNull();
      expect(edited.notes).toBeNull();
    });

    it("actualiza polymorphic header FLETE (ruta)", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({ purchaseType: "FLETE", ruta: "L-100" }),
      );
      const edited = purchase.applyEdit({ ruta: "L-200" });
      expect(edited.ruta).toBe("L-200");
    });

    it("actualiza polymorphic header POLLO_FAENADO (farmOrigin/chickenCount/shrinkagePct)", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          purchaseType: "POLLO_FAENADO",
          farmOrigin: "Granja A",
          chickenCount: 1000,
          shrinkagePct: 2.0,
        }),
      );
      const edited = purchase.applyEdit({
        farmOrigin: "Granja B",
        chickenCount: 1500,
        shrinkagePct: 3.0,
      });
      expect(edited.farmOrigin).toBe("Granja B");
      expect(edited.chickenCount).toBe(1500);
      expect(edited.shrinkagePct).toBe(3.0);
    });

    it("retorna nueva instancia sin mutar el original", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({ description: "Original" }),
      );
      const edited = purchase.applyEdit({ description: "Cambiado" });
      expect(edited).not.toBe(purchase);
      expect(purchase.description).toBe("Original");
    });

    it("permite edit desde DRAFT, POSTED y LOCKED", () => {
      for (const status of ["DRAFT", "POSTED", "LOCKED"] as const) {
        const purchase = Purchase.fromPersistence(buildPurchaseProps({ status }));
        expect(() => purchase.applyEdit({ description: "X" })).not.toThrow();
      }
    });

    it("rechaza edit desde VOIDED", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "VOIDED" }));
      expect(() => purchase.applyEdit({ description: "X" })).toThrow(
        PurchaseVoidedImmutable,
      );
    });
  });

  describe("replaceDetails", () => {
    it("reemplaza details y recomputa totalAmount", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          details: [buildDetail("purchase-1", 100, 0)],
          totalAmount: MonetaryAmount.of(100),
        }),
      );
      const newDetails = [
        buildDetail("purchase-1", 50, 0),
        buildDetail("purchase-1", 75.5, 1),
      ];
      const updated = purchase.replaceDetails(newDetails);
      expect(updated.details).toHaveLength(2);
      expect(updated.totalAmount.value).toBe(125.5);
    });

    it("permite replaceDetails con array vacío en DRAFT", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          details: [buildDetail("purchase-1", 100, 0)],
        }),
      );
      const updated = purchase.replaceDetails([]);
      expect(updated.details).toEqual([]);
      expect(updated.totalAmount.value).toBe(0);
    });

    it("rechaza replaceDetails con array vacío en POSTED", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "POSTED",
          details: [buildDetail("purchase-1", 100, 0)],
        }),
      );
      expect(() => purchase.replaceDetails([])).toThrow(PurchaseNoDetails);
    });

    it("rechaza replaceDetails con array vacío en LOCKED", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "LOCKED",
          details: [buildDetail("purchase-1", 100, 0)],
        }),
      );
      expect(() => purchase.replaceDetails([])).toThrow(PurchaseNoDetails);
    });

    it("rechaza replaceDetails desde VOIDED", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "VOIDED" }));
      expect(() =>
        purchase.replaceDetails([buildDetail("purchase-1", 100, 0)]),
      ).toThrow(PurchaseVoidedImmutable);
    });

    it("rechaza replaceDetails si COMPRA_GENERAL detail sin expenseAccountId", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          purchaseType: "COMPRA_GENERAL",
          details: [buildDetail("purchase-1", 100, 0, "acc-1")],
        }),
      );
      expect(() =>
        purchase.replaceDetails([buildDetail("purchase-1", 50, 0, null)]),
      ).toThrow(PurchaseExpenseAccountsRequired);
    });

    it("retorna nueva instancia sin mutar el original", () => {
      const purchase = Purchase.fromPersistence(
        buildPurchaseProps({
          status: "DRAFT",
          details: [buildDetail("purchase-1", 100, 0)],
        }),
      );
      const updated = purchase.replaceDetails([buildDetail("purchase-1", 200, 0)]);
      expect(updated).not.toBe(purchase);
      expect(purchase.totalAmount.value).toBe(0);
    });
  });

  describe("assignSequenceNumber", () => {
    it("returns a new instance with sequenceNumber set", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "POSTED" }));
      const numbered = purchase.assignSequenceNumber(42);
      expect(numbered).not.toBe(purchase);
      expect(numbered.sequenceNumber).toBe(42);
      expect(purchase.sequenceNumber).toBeNull();
    });
  });

  describe("linkJournal", () => {
    it("returns a new instance with journalEntryId set", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "POSTED" }));
      const linked = purchase.linkJournal("journal-99");
      expect(linked).not.toBe(purchase);
      expect(linked.journalEntryId).toBe("journal-99");
      expect(purchase.journalEntryId).toBeNull();
    });
  });

  describe("linkPayable", () => {
    it("returns a new instance with payableId set", () => {
      const purchase = Purchase.fromPersistence(buildPurchaseProps({ status: "POSTED" }));
      const linked = purchase.linkPayable("payable-99");
      expect(linked).not.toBe(purchase);
      expect(linked.payableId).toBe("payable-99");
      expect(purchase.payableId).toBeNull();
    });
  });
});
