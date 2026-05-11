import { describe, it, expect } from "vitest";

/**
 * C0 RED — Domain layer shape tests for POC dispatch-hex migration.
 * Mirror: modules/sale/__tests__/a2-seed-structure.test.ts pattern.
 *
 * Validates all domain layer artefacts exist and export expected shapes:
 * - DispatchStatus value object
 * - DispatchType value object
 * - DispatchDetail child entity
 * - Dispatch root entity
 * - Domain errors
 * - Repository port interface
 * - Accounting port interfaces (JournalEntryFactory, AccountBalances)
 * - roundTotal pure domain function
 * - computeLineAmounts pure domain function
 * - computeBcSummary pure domain function
 */

// ── Value Objects ──────────────────────────────────────────────────────────

import {
  DISPATCH_STATUSES,
  type DispatchStatus,
  parseDispatchStatus,
} from "../domain/value-objects/dispatch-status";

import {
  DISPATCH_TYPES,
  type DispatchType,
  parseDispatchType,
} from "../domain/value-objects/dispatch-type";

import {
  ReceivableSummary,
  type ReceivableSummaryProps,
} from "../domain/value-objects/receivable-summary";

import {
  PaymentAllocationSummary,
  type PaymentAllocationSummaryProps,
} from "../domain/value-objects/payment-allocation-summary";

// ── Entities ───────────────────────────────────────────────────────────────

import {
  DispatchDetail,
  type DispatchDetailProps,
  type CreateDispatchDetailInput,
} from "../domain/dispatch-detail.entity";

import {
  Dispatch,
  type DispatchProps,
  type CreateDispatchDraftInput,
  type ApplyDispatchEditInput,
} from "../domain/dispatch.entity";

// ── Errors ─────────────────────────────────────────────────────────────────

import {
  InvalidDispatchStatus,
  InvalidDispatchType,
  InvalidDispatchDetailLine,
  DispatchNoDetails,
  DispatchNotDraft,
  InvalidDispatchStatusTransition,
  DispatchVoidedImmutable,
  DispatchBcFieldsOnNd,
} from "../domain/errors/dispatch-errors";

// ── Ports ──────────────────────────────────────────────────────────────────

import type {
  DispatchRepository,
  DispatchFilters,
} from "../domain/ports/dispatch.repository";

import type {
  DispatchJournalTemplate,
  DispatchJournalLineTemplate,
  DispatchJournalEntryFactoryPort,
  DispatchRegenerateJournalResult,
} from "../domain/ports/dispatch-journal-entry-factory.port";

import type {
  DispatchAccountBalancesPort,
} from "../domain/ports/dispatch-account-balances.port";

import type {
  DispatchOrgSettingsReaderPort,
} from "../domain/ports/dispatch-org-settings-reader.port";

import type {
  DispatchContactsPort,
} from "../domain/ports/dispatch-contacts.port";

import type {
  DispatchFiscalPeriodsPort,
} from "../domain/ports/dispatch-fiscal-periods.port";

import type {
  DispatchReceivablesPort,
} from "../domain/ports/dispatch-receivables.port";

// ── Pure domain functions ──────────────────────────────────────────────────

import { roundTotal } from "../domain/round-total";
import {
  computeLineAmounts,
  type ComputedDetail,
} from "../domain/compute-line-amounts";
import {
  computeBcSummary,
  type BcSummary,
} from "../domain/compute-bc-summary";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("POC dispatch-hex C0 — domain layer shape", () => {
  // ── Value Objects ────────────────────────────────────────────────────────

  describe("DispatchStatus value object", () => {
    it("exports the four canonical statuses", () => {
      expect(DISPATCH_STATUSES).toEqual(["DRAFT", "POSTED", "LOCKED", "VOIDED"]);
    });

    it("parseDispatchStatus accepts valid values", () => {
      expect(parseDispatchStatus("DRAFT")).toBe("DRAFT");
      expect(parseDispatchStatus("POSTED")).toBe("POSTED");
      expect(parseDispatchStatus("LOCKED")).toBe("LOCKED");
      expect(parseDispatchStatus("VOIDED")).toBe("VOIDED");
    });

    it("parseDispatchStatus rejects invalid values", () => {
      expect(() => parseDispatchStatus("INVALID")).toThrow(InvalidDispatchStatus);
    });
  });

  describe("DispatchType value object", () => {
    it("exports the two canonical dispatch types", () => {
      expect(DISPATCH_TYPES).toEqual(["NOTA_DESPACHO", "BOLETA_CERRADA"]);
    });

    it("parseDispatchType accepts valid values", () => {
      expect(parseDispatchType("NOTA_DESPACHO")).toBe("NOTA_DESPACHO");
      expect(parseDispatchType("BOLETA_CERRADA")).toBe("BOLETA_CERRADA");
    });

    it("parseDispatchType rejects invalid values", () => {
      expect(() => parseDispatchType("INVALID")).toThrow(InvalidDispatchType);
    });
  });

  // ── DispatchDetail child entity ──────────────────────────────────────────

  describe("DispatchDetail child entity", () => {
    it("creates a detail with valid inputs", () => {
      const detail = DispatchDetail.create({
        dispatchId: "dispatch-1",
        description: "Pollo entero",
        boxes: 10,
        grossWeight: 250,
        tare: 20,
        netWeight: 230,
        unitPrice: 15,
        lineAmount: 3450,
        order: 0,
      });
      expect(detail.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(detail.dispatchId).toBe("dispatch-1");
      expect(detail.description).toBe("Pollo entero");
      expect(detail.boxes).toBe(10);
      expect(detail.grossWeight).toBe(250);
      expect(detail.tare).toBe(20);
      expect(detail.netWeight).toBe(230);
      expect(detail.unitPrice).toBe(15);
      expect(detail.lineAmount).toBe(3450);
      expect(detail.order).toBe(0);
    });

    it("rejects empty description", () => {
      expect(() =>
        DispatchDetail.create({
          dispatchId: "dispatch-1",
          description: "",
          boxes: 10,
          grossWeight: 250,
          tare: 20,
          netWeight: 230,
          unitPrice: 15,
          lineAmount: 3450,
          order: 0,
        }),
      ).toThrow(InvalidDispatchDetailLine);
    });

    it("reconstructs from persistence", () => {
      const props: DispatchDetailProps = {
        id: "det-1",
        dispatchId: "dispatch-1",
        description: "Pollo",
        boxes: 5,
        grossWeight: 100,
        tare: 10,
        netWeight: 90,
        unitPrice: 12,
        lineAmount: 1080,
        order: 0,
      };
      const detail = DispatchDetail.fromPersistence(props);
      expect(detail.id).toBe("det-1");
    });
  });

  // ── Dispatch root entity ─────────────────────────────────────────────────

  describe("Dispatch root entity", () => {
    it("createDraft returns a Dispatch in DRAFT status", () => {
      const dispatch = Dispatch.createDraft({
        organizationId: "org-1",
        dispatchType: "NOTA_DESPACHO",
        contactId: "contact-1",
        periodId: "period-1",
        date: new Date("2026-05-11"),
        description: "Despacho prueba",
        createdById: "user-1",
        details: [
          {
            dispatchId: "", // placeholder — entity assigns
            description: "L0",
            boxes: 5,
            grossWeight: 100,
            tare: 10,
            netWeight: 90,
            unitPrice: 10,
            lineAmount: 900,
            order: 0,
          },
        ],
      });
      expect(dispatch.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(dispatch.status).toBe("DRAFT");
      expect(dispatch.dispatchType).toBe("NOTA_DESPACHO");
      expect(dispatch.sequenceNumber).toBe(0);
      expect(dispatch.totalAmount).toBe(0);
      expect(dispatch.journalEntryId).toBeNull();
      expect(dispatch.receivableId).toBeNull();
      expect(dispatch.details).toHaveLength(1);
    });

    it("fromPersistence reconstructs with all properties", () => {
      const now = new Date();
      const dispatch = Dispatch.fromPersistence({
        id: "d-1",
        organizationId: "org-1",
        dispatchType: "NOTA_DESPACHO",
        status: "POSTED",
        sequenceNumber: 42,
        date: now,
        contactId: "c-1",
        periodId: "p-1",
        description: "Test",
        referenceNumber: null,
        notes: null,
        totalAmount: 5000,
        journalEntryId: "j-1",
        receivableId: "r-1",
        createdById: "u-1",
        createdAt: now,
        updatedAt: now,
        details: [],
        receivable: null,
        farmOrigin: null,
        chickenCount: null,
        shrinkagePct: null,
        avgKgPerChicken: null,
        totalGrossKg: null,
        totalNetKg: null,
        totalShrinkKg: null,
        totalShortageKg: null,
        totalRealNetKg: null,
      });
      expect(dispatch.id).toBe("d-1");
      expect(dispatch.status).toBe("POSTED");
      expect(dispatch.sequenceNumber).toBe(42);
      expect(dispatch.totalAmount).toBe(5000);
    });

    describe("state transitions", () => {
      it("post: DRAFT → POSTED", () => {
        const draft = Dispatch.createDraft({
          organizationId: "org-1",
          dispatchType: "NOTA_DESPACHO",
          contactId: "c-1",
          periodId: "p-1",
          date: new Date(),
          description: "D",
          createdById: "u-1",
          details: [
            {
              dispatchId: "",
              description: "L",
              boxes: 1,
              grossWeight: 10,
              tare: 2,
              netWeight: 8,
              unitPrice: 10,
              lineAmount: 80,
              order: 0,
            },
          ],
        });
        const posted = draft.post();
        expect(posted.status).toBe("POSTED");
      });

      it("post rejects POSTED → POSTED", () => {
        const now = new Date();
        const posted = Dispatch.fromPersistence({
          id: "d-1",
          organizationId: "org-1",
          dispatchType: "NOTA_DESPACHO",
          status: "POSTED",
          sequenceNumber: 1,
          date: now,
          contactId: "c-1",
          periodId: "p-1",
          description: "D",
          referenceNumber: null,
          notes: null,
          totalAmount: 100,
          journalEntryId: null,
          receivableId: null,
          createdById: "u-1",
          createdAt: now,
          updatedAt: now,
          details: [
            DispatchDetail.fromPersistence({
              id: "det-1",
              dispatchId: "d-1",
              description: "L",
              boxes: 1,
              grossWeight: 10,
              tare: 2,
              netWeight: 8,
              unitPrice: 10,
              lineAmount: 80,
              order: 0,
            }),
          ],
          receivable: null,
          farmOrigin: null,
          chickenCount: null,
          shrinkagePct: null,
          avgKgPerChicken: null,
          totalGrossKg: null,
          totalNetKg: null,
          totalShrinkKg: null,
          totalShortageKg: null,
          totalRealNetKg: null,
        });
        expect(() => posted.post()).toThrow(InvalidDispatchStatusTransition);
      });

      it("void: POSTED → VOIDED", () => {
        const now = new Date();
        const posted = Dispatch.fromPersistence({
          id: "d-1",
          organizationId: "org-1",
          dispatchType: "NOTA_DESPACHO",
          status: "POSTED",
          sequenceNumber: 1,
          date: now,
          contactId: "c-1",
          periodId: "p-1",
          description: "D",
          referenceNumber: null,
          notes: null,
          totalAmount: 100,
          journalEntryId: null,
          receivableId: null,
          createdById: "u-1",
          createdAt: now,
          updatedAt: now,
          details: [],
          receivable: null,
          farmOrigin: null,
          chickenCount: null,
          shrinkagePct: null,
          avgKgPerChicken: null,
          totalGrossKg: null,
          totalNetKg: null,
          totalShrinkKg: null,
          totalShortageKg: null,
          totalRealNetKg: null,
        });
        const voided = posted.void();
        expect(voided.status).toBe("VOIDED");
      });

      it("lock: POSTED → LOCKED", () => {
        const now = new Date();
        const posted = Dispatch.fromPersistence({
          id: "d-1",
          organizationId: "org-1",
          dispatchType: "NOTA_DESPACHO",
          status: "POSTED",
          sequenceNumber: 1,
          date: now,
          contactId: "c-1",
          periodId: "p-1",
          description: "D",
          referenceNumber: null,
          notes: null,
          totalAmount: 100,
          journalEntryId: null,
          receivableId: null,
          createdById: "u-1",
          createdAt: now,
          updatedAt: now,
          details: [],
          receivable: null,
          farmOrigin: null,
          chickenCount: null,
          shrinkagePct: null,
          avgKgPerChicken: null,
          totalGrossKg: null,
          totalNetKg: null,
          totalShrinkKg: null,
          totalShortageKg: null,
          totalRealNetKg: null,
        });
        const locked = posted.lock();
        expect(locked.status).toBe("LOCKED");
      });

      it("rejects mutation on VOIDED", () => {
        const now = new Date();
        const voided = Dispatch.fromPersistence({
          id: "d-1",
          organizationId: "org-1",
          dispatchType: "NOTA_DESPACHO",
          status: "VOIDED",
          sequenceNumber: 1,
          date: now,
          contactId: "c-1",
          periodId: "p-1",
          description: "D",
          referenceNumber: null,
          notes: null,
          totalAmount: 100,
          journalEntryId: null,
          receivableId: null,
          createdById: "u-1",
          createdAt: now,
          updatedAt: now,
          details: [],
          receivable: null,
          farmOrigin: null,
          chickenCount: null,
          shrinkagePct: null,
          avgKgPerChicken: null,
          totalGrossKg: null,
          totalNetKg: null,
          totalShrinkKg: null,
          totalShortageKg: null,
          totalRealNetKg: null,
        });
        expect(() => voided.post()).toThrow(DispatchVoidedImmutable);
        expect(() => voided.void()).toThrow(DispatchVoidedImmutable);
      });

      it("post requires at least one detail", () => {
        const draft = Dispatch.createDraft({
          organizationId: "org-1",
          dispatchType: "NOTA_DESPACHO",
          contactId: "c-1",
          periodId: "p-1",
          date: new Date(),
          description: "D",
          createdById: "u-1",
          details: [],
        });
        expect(() => draft.post()).toThrow(DispatchNoDetails);
      });
    });

    it("assertCanDelete rejects non-DRAFT", () => {
      const now = new Date();
      const posted = Dispatch.fromPersistence({
        id: "d-1",
        organizationId: "org-1",
        dispatchType: "NOTA_DESPACHO",
        status: "POSTED",
        sequenceNumber: 1,
        date: now,
        contactId: "c-1",
        periodId: "p-1",
        description: "D",
        referenceNumber: null,
        notes: null,
        totalAmount: 100,
        journalEntryId: null,
        receivableId: null,
        createdById: "u-1",
        createdAt: now,
        updatedAt: now,
        details: [],
        receivable: null,
        farmOrigin: null,
        chickenCount: null,
        shrinkagePct: null,
        avgKgPerChicken: null,
        totalGrossKg: null,
        totalNetKg: null,
        totalShrinkKg: null,
        totalShortageKg: null,
        totalRealNetKg: null,
      });
      expect(() => posted.assertCanDelete()).toThrow(DispatchNotDraft);
    });

    it("applyEdit updates header fields", () => {
      const draft = Dispatch.createDraft({
        organizationId: "org-1",
        dispatchType: "NOTA_DESPACHO",
        contactId: "c-1",
        periodId: "p-1",
        date: new Date("2026-01-01"),
        description: "Original",
        createdById: "u-1",
        details: [],
      });
      const edited = draft.applyEdit({ description: "Editado" });
      expect(edited.description).toBe("Editado");
      expect(edited.date).toEqual(new Date("2026-01-01"));
    });

    it("assignSequenceNumber returns updated entity", () => {
      const draft = Dispatch.createDraft({
        organizationId: "org-1",
        dispatchType: "NOTA_DESPACHO",
        contactId: "c-1",
        periodId: "p-1",
        date: new Date(),
        description: "D",
        createdById: "u-1",
        details: [],
      });
      const assigned = draft.assignSequenceNumber(42);
      expect(assigned.sequenceNumber).toBe(42);
    });
  });

  // ── Pure domain functions ────────────────────────────────────────────────

  describe("roundTotal", () => {
    it("rounds down when first decimal < threshold", () => {
      expect(roundTotal(100.3, 0.7)).toBe(100);
    });

    it("rounds up when first decimal >= threshold", () => {
      expect(roundTotal(100.7, 0.7)).toBe(101);
    });
  });

  describe("computeLineAmounts — NOTA_DESPACHO", () => {
    it("computes lineAmount = netWeight × unitPrice", () => {
      const results = computeLineAmounts(
        [
          {
            description: "Pollo",
            boxes: 5,
            grossWeight: 100,
            unitPrice: 10,
            order: 0,
          },
        ],
        "NOTA_DESPACHO",
        0,
      );
      expect(results).toHaveLength(1);
      const d = results[0];
      expect(d.tare).toBe(10); // boxes * 2
      expect(d.netWeight).toBe(90); // grossWeight - tare
      expect(d.lineAmount).toBe(900); // netWeight * unitPrice
    });
  });

  describe("computeLineAmounts — BOLETA_CERRADA", () => {
    it("computes with shrinkage and shortage", () => {
      const results = computeLineAmounts(
        [
          {
            description: "Pollo BC",
            boxes: 5,
            grossWeight: 100,
            unitPrice: 10,
            shortage: 2,
            order: 0,
          },
        ],
        "BOLETA_CERRADA",
        5, // 5% shrinkage
      );
      expect(results).toHaveLength(1);
      const d = results[0];
      expect(d.tare).toBe(10);
      expect(d.netWeight).toBe(90);
      expect(d.shrinkage).toBe(4.5); // 90 * 5/100
      expect(d.shortage).toBe(2);
      expect(d.realNetWeight).toBe(83.5); // 90 - 4.5 - 2
      expect(d.lineAmount).toBe(835); // 83.5 * 10
    });
  });

  describe("computeBcSummary", () => {
    it("aggregates header fields from computed details", () => {
      const details: ComputedDetail[] = [
        {
          description: "L1",
          boxes: 5,
          grossWeight: 100,
          tare: 10,
          netWeight: 90,
          unitPrice: 10,
          lineAmount: 835,
          order: 0,
          shrinkage: 4.5,
          shortage: 2,
          realNetWeight: 83.5,
        },
      ];
      const summary = computeBcSummary(details, 50);
      expect(summary.totalGrossKg).toBe(100);
      expect(summary.totalNetKg).toBe(90);
      expect(summary.totalShrinkKg).toBe(4.5);
      expect(summary.totalShortageKg).toBe(2);
      expect(summary.totalRealNetKg).toBe(83.5);
      expect(summary.avgKgPerChicken).toBeCloseTo(1.8); // 90/50
    });
  });

  // ── Port type-checks ────────────────────────────────────────────────────

  describe("port interfaces compile", () => {
    it("DispatchRepository port has expected methods", () => {
      type Methods = keyof DispatchRepository;
      const methods: Methods[] = [
        "findById",
        "findAll",
        "findByIdTx",
        "saveTx",
        "updateTx",
        "deleteTx",
        "getNextSequenceNumberTx",
        "linkJournalAndReceivableTx",
        "updateStatusTx",
        "cloneToDraftTx",
      ];
      expect(methods).toHaveLength(10);
    });

    it("DispatchJournalEntryFactoryPort port has expected method", () => {
      type Methods = keyof DispatchJournalEntryFactoryPort;
      const methods: Methods[] = [
        "generateForDispatch",
        "regenerateForDispatchEdit",
      ];
      expect(methods).toHaveLength(2);
    });

    it("DispatchAccountBalancesPort port has expected methods", () => {
      type Methods = keyof DispatchAccountBalancesPort;
      const methods: Methods[] = ["applyPost", "applyVoid"];
      expect(methods).toHaveLength(2);
    });

    it("DispatchOrgSettingsReaderPort port has expected method", () => {
      type Methods = keyof DispatchOrgSettingsReaderPort;
      const methods: Methods[] = ["getOrCreate"];
      expect(methods).toHaveLength(1);
    });

    it("DispatchContactsPort port has expected method", () => {
      type Methods = keyof DispatchContactsPort;
      const methods: Methods[] = ["getActiveById"];
      expect(methods).toHaveLength(1);
    });

    it("DispatchFiscalPeriodsPort port has expected method", () => {
      type Methods = keyof DispatchFiscalPeriodsPort;
      const methods: Methods[] = ["getById"];
      expect(methods).toHaveLength(1);
    });

    it("DispatchReceivablesPort port has expected methods", () => {
      type Methods = keyof DispatchReceivablesPort;
      const methods: Methods[] = ["createTx", "voidTx"];
      expect(methods).toHaveLength(2);
    });
  });

  // ── Unused type imports ──────────────────────────────────────────────────

  it("keeps all type symbols live in the build graph", () => {
    type Wired =
      | ReceivableSummaryProps
      | PaymentAllocationSummaryProps
      | DispatchDetailProps
      | CreateDispatchDetailInput
      | DispatchProps
      | CreateDispatchDraftInput
      | ApplyDispatchEditInput
      | DispatchFilters
      | DispatchJournalTemplate
      | DispatchJournalLineTemplate
      | DispatchRegenerateJournalResult
      | ComputedDetail
      | BcSummary;
    const _: Wired = null as never;
    expect(_).toBeNull();
  });
});
