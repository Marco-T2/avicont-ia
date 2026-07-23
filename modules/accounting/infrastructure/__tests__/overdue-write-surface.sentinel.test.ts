/**
 * α-sentinel: OVERDUE write-surface closure (DEC-A, settlement-invariant-hardening,
 * corrected by Batch 3-FIX after the adversarial verify of 018f359f).
 *
 * Cements Marco's DEC-A with ENTRY-CLOSED / EXIT-OPEN semantics:
 *  - ENTRY closed — no row can newly REACH OVERDUE:
 *    · zod write schemas (`receivableStatusSchema` / `payableStatusSchema`)
 *      refuse status "OVERDUE" (PATCH /status → 400, was 200);
 *    · create/update zod schemas carry NO `status` field at all;
 *    · domain ALLOWED tables refuse OVERDUE as a transition TARGET from
 *      every source (both sisters);
 *    · `Receivable.create()` / `Payable.create()` and `createTx` pin PENDING;
 *    · the persistence boundary guard (`assertPersistableStatus`, both
 *      mappers) THROWS if an entity/status carrying OVERDUE reaches the
 *      repository write paths that persist a caller-supplied status
 *      (save via toPersistence, update, applyAllocationTx,
 *      revertAllocationTx) — closing the rehydrate-then-write-back hole
 *      (verify F-1); createTx/voidTx write literal PENDING/VOIDED. The only
 *      AR/AP status write sites in production code are these repositories.
 *  - EXIT open — a legacy row already sitting in OVERDUE can DRAIN:
 *    canTransition(OVERDUE → PARTIAL|PAID|VOIDED) stays true (verify F-2:
 *    `OVERDUE: []` made `.void()` throw and rolled back whole sale/purchase
 *    voids). A regression back to `OVERDUE: []` must RED here.
 *  - GREEN-GUARD (DEC-A1): `toSettlementStatus("OVERDUE")` stays "PENDING" —
 *    the mapper is TOTAL by locked design; this branch is never removed
 *    (sister sentinel: settlement-status-enum.sentinel.test.ts).
 *
 * While legacy OVERDUE rows exist (until Batch 5's sanitizing migration), a
 * description-only edit of such a row THROWS at the persistence boundary
 * instead of silently re-persisting OVERDUE — fail loud, not silent.
 *
 * Overdue semantics still EXIST downstream: display derives ATRASADO
 * (dueDate < now over PENDING/PARTIAL) in the contact-ledger UI and the
 * PDF/XLSX exporters — derived at read, never persisted.
 *
 * BEHAVIORAL sentinel (design D-4): asserts the real schemas/tables/repos
 * reject OVERDUE — no source regex scan ([[sentinel_regex_line_bound]] N/A).
 *
 * Declared failure modes (Batch 3-FIX RED at 018f359f):
 *  - exits-open + drain tests: "expected false to be true" /
 *    InvalidReceivableStatusTransition thrown by `.void()` (F-2 repro);
 *  - persistence-guard tests: promise resolved / function did not throw —
 *    OVERDUE was written verbatim (F-1 repro);
 *  - schema-shape, create-pin, entry-closed and GREEN-GUARD tests are
 *    born-green positive controls and must NEVER go red; if one does, STOP
 *    and escalate (DEC-A/DEC-A1).
 */

import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  createReceivableSchema,
  updateReceivableSchema,
  receivableStatusSchema,
} from "@/modules/receivables/presentation/validation";
import {
  createPayableSchema,
  updatePayableSchema,
  payableStatusSchema,
} from "@/modules/payables/presentation/validation";
import {
  canTransition as canTransitionReceivable,
} from "@/modules/receivables/domain/value-objects/receivable-status";
import type { ReceivableStatus } from "@/modules/receivables/domain/value-objects/receivable-status";
import {
  canTransition as canTransitionPayable,
} from "@/modules/payables/domain/value-objects/payable-status";
import type { PayableStatus } from "@/modules/payables/domain/value-objects/payable-status";
import { toSettlementStatus } from "@/modules/shared/domain/value-objects/settlement-status";
import { Receivable } from "@/modules/receivables/domain/receivable.entity";
import { Payable } from "@/modules/payables/domain/payable.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { PrismaReceivablesRepository } from "@/modules/receivables/infrastructure/prisma-receivables.repository";
import { PrismaPayablesRepository } from "@/modules/payables/infrastructure/prisma-payables.repository";
import { toPersistence as toReceivablePersistence } from "@/modules/receivables/infrastructure/receivables.mapper";
import { toPersistence as toPayablePersistence } from "@/modules/payables/infrastructure/payables.mapper";

const DUE = new Date("2026-05-15");

/** Rehydrated AR entity — the F-1 vector: a legacy row read back from the DB. */
const rehydrateReceivable = (status: ReceivableStatus) =>
  Receivable.fromPersistence({
    id: "rec-1",
    organizationId: "org-1",
    contactId: "contact-1",
    description: "Factura",
    amount: MonetaryAmount.of(1000),
    paid: MonetaryAmount.zero(),
    balance: MonetaryAmount.of(1000),
    dueDate: DUE,
    status,
    sourceType: null,
    sourceId: null,
    journalEntryId: "je-1",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const rehydratePayable = (status: PayableStatus) =>
  Payable.fromPersistence({
    id: "pay-1",
    organizationId: "org-1",
    contactId: "contact-1",
    description: "Factura compra",
    amount: MonetaryAmount.of(1000),
    paid: MonetaryAmount.zero(),
    balance: MonetaryAmount.of(1000),
    dueDate: DUE,
    status,
    sourceType: null,
    sourceId: null,
    journalEntryId: "je-1",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

/** Stub clients per prisma-*.repository.test.ts pattern. No `$transaction`
 *  key → the repo's `atomically` guard runs writes directly on the stub. */
const arDb = (overrides: Record<string, unknown> = {}) =>
  ({
    accountsReceivable: {
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
    journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }) as unknown as PrismaClient & {
    accountsReceivable: { update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    journalEntry: { updateMany: ReturnType<typeof vi.fn> };
  };

const apDb = (overrides: Record<string, unknown> = {}) =>
  ({
    accountsPayable: {
      update: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
    journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }) as unknown as PrismaClient & {
    accountsPayable: { update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
    journalEntry: { updateMany: ReturnType<typeof vi.fn> };
  };

describe("α-sentinel — OVERDUE write-surface closure (DEC-A)", () => {
  describe("zod write schemas reject OVERDUE", () => {
    it("receivableStatusSchema rejects status OVERDUE", () => {
      expect(receivableStatusSchema.safeParse({ status: "OVERDUE" }).success).toBe(false);
    });

    it("payableStatusSchema rejects status OVERDUE", () => {
      expect(payableStatusSchema.safeParse({ status: "OVERDUE" }).success).toBe(false);
    });

    it.each(["PENDING", "PARTIAL", "PAID", "VOIDED"] as const)(
      "positive control (born-green): write schemas still accept %s",
      (status) => {
        expect(receivableStatusSchema.safeParse({ status }).success).toBe(true);
        expect(payableStatusSchema.safeParse({ status }).success).toBe(true);
      },
    );
  });

  describe("create/update zod schemas carry NO status field (F-1 cementación)", () => {
    // Re-adding a `status` key to any of these schemas re-opens a
    // client-controlled entry into arbitrary statuses — must RED here.
    it.each([
      ["createReceivableSchema", createReceivableSchema],
      ["updateReceivableSchema", updateReceivableSchema],
      ["createPayableSchema", createPayableSchema],
      ["updatePayableSchema", updatePayableSchema],
    ] as const)("%s has no status key", (_name, schema) => {
      expect(Object.keys(schema.shape)).not.toContain("status");
    });
  });

  describe("entity creation pins PENDING", () => {
    it("Receivable.create() / Payable.create() start PENDING", () => {
      expect(
        Receivable.create({
          organizationId: "org-1",
          contactId: "c-1",
          description: "x",
          amount: 100,
          dueDate: DUE,
        }).status,
      ).toBe("PENDING");
      expect(
        Payable.create({
          organizationId: "org-1",
          contactId: "c-1",
          description: "x",
          amount: 100,
          dueDate: DUE,
        }).status,
      ).toBe("PENDING");
    });

    it("createTx writes literal PENDING in both repositories", async () => {
      const arCreate = vi.fn().mockResolvedValue({ id: "new-ar" });
      const apCreate = vi.fn().mockResolvedValue({ id: "new-ap" });
      const je = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
      const input = {
        organizationId: "org-1",
        contactId: "c-1",
        description: "x",
        amount: 100,
        dueDate: DUE,
      };

      await new PrismaReceivablesRepository(arDb()).createTx(
        { accountsReceivable: { create: arCreate }, journalEntry: je },
        input,
      );
      await new PrismaPayablesRepository(apDb()).createTx(
        { accountsPayable: { create: apCreate }, journalEntry: je },
        input,
      );

      expect(arCreate.mock.calls[0]?.[0]?.data.status).toBe("PENDING");
      expect(apCreate.mock.calls[0]?.[0]?.data.status).toBe("PENDING");
    });
  });

  describe("domain ALLOWED tables reject OVERDUE as target (entry closed)", () => {
    it.each(["PENDING", "PARTIAL"] as const)(
      "receivables: canTransition(%s, OVERDUE) is false",
      (from) => {
        expect(canTransitionReceivable(from, "OVERDUE")).toBe(false);
      },
    );

    it.each(["PENDING", "PARTIAL"] as const)(
      "payables: canTransition(%s, OVERDUE) is false",
      (from) => {
        expect(canTransitionPayable(from, "OVERDUE")).toBe(false);
      },
    );

    it("positive control (born-green): PENDING → PAID stays allowed in both sisters", () => {
      expect(canTransitionReceivable("PENDING", "PAID")).toBe(true);
      expect(canTransitionPayable("PENDING", "PAID")).toBe(true);
    });
  });

  describe("OVERDUE exits stay OPEN — legacy rows must drain (F-2)", () => {
    // Regression to `OVERDUE: []` walls legacy rows in: `.void()` throws and
    // the surrounding sale/purchase void $transaction rolls back entirely.
    it.each(["PARTIAL", "PAID", "VOIDED"] as const)(
      "receivables: canTransition(OVERDUE, %s) is true",
      (target) => {
        expect(canTransitionReceivable("OVERDUE", target)).toBe(true);
      },
    );

    it.each(["PARTIAL", "PAID", "VOIDED"] as const)(
      "payables: canTransition(OVERDUE, %s) is true",
      (target) => {
        expect(canTransitionPayable("OVERDUE", target)).toBe(true);
      },
    );

    it("OVERDUE cannot loop back to PENDING, CANCELLED or itself (both sisters)", () => {
      for (const target of ["PENDING", "CANCELLED", "OVERDUE"] as const) {
        expect(canTransitionReceivable("OVERDUE", target)).toBe(false);
        expect(canTransitionPayable("OVERDUE", target)).toBe(false);
      }
    });

    it("F-2 repro: .void() on an OVERDUE row succeeds → VOIDED (both sisters)", () => {
      expect(rehydrateReceivable("OVERDUE").void().status).toBe("VOIDED");
      expect(rehydratePayable("OVERDUE").void().status).toBe("VOIDED");
    });

    it("triangulation: OVERDUE row can also be settled PAID (both sisters)", () => {
      expect(rehydrateReceivable("OVERDUE").transitionTo("PAID").status).toBe("PAID");
      expect(rehydratePayable("OVERDUE").transitionTo("PAID").status).toBe("PAID");
    });
  });

  describe("persistence boundary guard — OVERDUE is never WRITTEN (F-1)", () => {
    it("F-1 repro: description-only update of a rehydrated OVERDUE receivable is REJECTED, nothing written", async () => {
      const db = arDb();
      const repo = new PrismaReceivablesRepository(db);
      const edited = rehydrateReceivable("OVERDUE").update({ description: "edit" });

      await expect(repo.update(edited)).rejects.toThrow(/OVERDUE.*DEC-A/s);
      expect(db.accountsReceivable.update).not.toHaveBeenCalled();
      expect(db.journalEntry.updateMany).not.toHaveBeenCalled();
    });

    it("F-1 repro (sister): description-only update of a rehydrated OVERDUE payable is REJECTED, nothing written", async () => {
      const db = apDb();
      const repo = new PrismaPayablesRepository(db);
      const edited = rehydratePayable("OVERDUE").update({ description: "edit" });

      await expect(repo.update(edited)).rejects.toThrow(/OVERDUE.*DEC-A/s);
      expect(db.accountsPayable.update).not.toHaveBeenCalled();
      expect(db.journalEntry.updateMany).not.toHaveBeenCalled();
    });

    it("save() of an OVERDUE entity is REJECTED in both repos (mapper choke point covers create)", async () => {
      const arClient = arDb();
      const apClient = apDb();

      await expect(
        new PrismaReceivablesRepository(arClient).save(rehydrateReceivable("OVERDUE")),
      ).rejects.toThrow(/OVERDUE.*DEC-A/s);
      await expect(
        new PrismaPayablesRepository(apClient).save(rehydratePayable("OVERDUE")),
      ).rejects.toThrow(/OVERDUE.*DEC-A/s);
      expect(arClient.accountsReceivable.create).not.toHaveBeenCalled();
      expect(apClient.accountsPayable.create).not.toHaveBeenCalled();
    });

    it("toPersistence throws directly on an OVERDUE entity (both mappers)", () => {
      expect(() => toReceivablePersistence(rehydrateReceivable("OVERDUE"))).toThrow(
        /OVERDUE.*DEC-A/s,
      );
      expect(() => toPayablePersistence(rehydratePayable("OVERDUE"))).toThrow(
        /OVERDUE.*DEC-A/s,
      );
    });

    it("applyAllocationTx / revertAllocationTx refuse a caller-supplied OVERDUE status (both repos)", async () => {
      const arRepo = new PrismaReceivablesRepository(arDb());
      const apRepo = new PrismaPayablesRepository(apDb());
      const tx = {
        accountsReceivable: { update: vi.fn() },
        accountsPayable: { update: vi.fn() },
        journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };

      await expect(
        arRepo.applyAllocationTx(tx, "org-1", "rec-1", MonetaryAmount.of(1), MonetaryAmount.of(999), "OVERDUE"),
      ).rejects.toThrow(/OVERDUE.*DEC-A/s);
      await expect(
        arRepo.revertAllocationTx(tx, "org-1", "rec-1", MonetaryAmount.zero(), MonetaryAmount.of(1000), "OVERDUE"),
      ).rejects.toThrow(/OVERDUE.*DEC-A/s);
      await expect(
        apRepo.applyAllocationTx(tx, "org-1", "pay-1", MonetaryAmount.of(1), MonetaryAmount.of(999), "OVERDUE"),
      ).rejects.toThrow(/OVERDUE.*DEC-A/s);
      await expect(
        apRepo.revertAllocationTx(tx, "org-1", "pay-1", MonetaryAmount.zero(), MonetaryAmount.of(1000), "OVERDUE"),
      ).rejects.toThrow(/OVERDUE.*DEC-A/s);
      expect(tx.accountsReceivable.update).not.toHaveBeenCalled();
      expect(tx.accountsPayable.update).not.toHaveBeenCalled();
    });

    it("legitimate drain passes the guard: voided ex-OVERDUE receivable persists as VOIDED", async () => {
      const db = arDb();
      const repo = new PrismaReceivablesRepository(db);
      const drained = rehydrateReceivable("OVERDUE").void();

      await expect(repo.update(drained)).resolves.toBeUndefined();
      expect(db.accountsReceivable.update.mock.calls[0]?.[0]?.data.status).toBe("VOIDED");
      expect(db.journalEntry.updateMany.mock.calls[0]?.[0]?.data.paymentStatus).toBe("VOIDED");
    });

    it("legitimate drain passes the guard: voided ex-OVERDUE payable persists as VOIDED", async () => {
      const db = apDb();
      const repo = new PrismaPayablesRepository(db);
      const drained = rehydratePayable("OVERDUE").void();

      await expect(repo.update(drained)).resolves.toBeUndefined();
      expect(db.accountsPayable.update.mock.calls[0]?.[0]?.data.status).toBe("VOIDED");
      expect(db.journalEntry.updateMany.mock.calls[0]?.[0]?.data.paymentStatus).toBe("VOIDED");
    });
  });

  describe("GREEN-GUARD (DEC-A1) — mapper stays total, branch preserved", () => {
    it("toSettlementStatus(OVERDUE) collapses to PENDING", () => {
      expect(toSettlementStatus("OVERDUE")).toBe("PENDING");
    });
  });
});
