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
 * BEHAVIORAL core (design D-4): asserts the real schemas/tables/repos reject
 * OVERDUE. Since Batch 3-POLISH (M-2) a STRUCTURAL scan at the bottom of this
 * file additionally enforces the write-site ENUMERATION itself (guard pairing
 * inside the two repositories + scripts/) — its regexes honor
 * [[sentinel_regex_line_bound]] (no longer N/A).
 *
 * Declared failure modes (Batch 3-FIX RED at 018f359f):
 *  - error-channel tests (M-1, Batch 3-POLISH RED at 85d55a6e): "to be an
 *    instance of ValidationError" / "expected 500 to be 422" against the
 *    bare-Error guard;
 *  - exits-open + drain tests: "expected false to be true" /
 *    InvalidReceivableStatusTransition thrown by `.void()` (F-2 repro);
 *  - persistence-guard tests: promise resolved / function did not throw —
 *    OVERDUE was written verbatim (F-1 repro);
 *  - schema-shape, create-pin, entry-closed and GREEN-GUARD tests are
 *    born-green positive controls and must NEVER go red; if one does, STOP
 *    and escalate (DEC-A/DEC-A1).
 */

import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  createReceivableSchema,
  updateReceivableSchema,
  receivableStatusSchema,
  receivableFiltersSchema,
} from "@/modules/receivables/presentation/validation";
import {
  createPayableSchema,
  updatePayableSchema,
  payableStatusSchema,
  payableFiltersSchema,
} from "@/modules/payables/presentation/validation";
import {
  canTransition as canTransitionReceivable,
  RECEIVABLE_STATUSES,
} from "@/modules/receivables/domain/value-objects/receivable-status";
import type { ReceivableStatus } from "@/modules/receivables/domain/value-objects/receivable-status";
import {
  canTransition as canTransitionPayable,
  PAYABLE_STATUSES,
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
import { ValidationError } from "@/modules/shared/domain/errors";
import { handleError } from "@/modules/shared/presentation/http-error-serializer";
import { OverdueReceivableNotPersistable } from "@/modules/receivables/domain/errors/receivable-errors";
import { OverduePayableNotPersistable } from "@/modules/payables/domain/errors/payable-errors";

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
    // EVERY enum member as source (L-1, Batch 3-POLISH): the header claims
    // "from every source" — parametrizing over the full status arrays makes
    // that absolute enforced, not asserted-by-sample.
    it.each([...RECEIVABLE_STATUSES])(
      "receivables: canTransition(%s, OVERDUE) is false",
      (from) => {
        expect(canTransitionReceivable(from, "OVERDUE")).toBe(false);
      },
    );

    it.each([...PAYABLE_STATUSES])(
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

  describe("guard error channel — ValidationError 422, never a bare 500 (M-1, Batch 3-POLISH)", () => {
    // Pins the error TYPE, not just the message: a bare `Error` carries the
    // same message but falls through `handleError`'s AppError branch to the
    // generic 500 — the remediation text never reaches the client and every
    // legacy-row edit is logged as an unhandled server error.
    const grab = (fn: () => unknown): unknown => {
      try {
        fn();
      } catch (e) {
        return e;
      }
      throw new Error("expected the guard to throw");
    };

    it("mapper guards throw a ValidationError (statusCode 422), not a bare Error (both sisters)", () => {
      const arError = grab(() => toReceivablePersistence(rehydrateReceivable("OVERDUE")));
      const apError = grab(() => toPayablePersistence(rehydratePayable("OVERDUE")));
      expect(arError).toBeInstanceOf(OverdueReceivableNotPersistable);
      expect(apError).toBeInstanceOf(OverduePayableNotPersistable);
      expect(arError).toBeInstanceOf(ValidationError);
      expect(apError).toBeInstanceOf(ValidationError);
      expect((arError as ValidationError).statusCode).toBe(422);
      expect((apError as ValidationError).statusCode).toBe(422);
    });

    it("handleError serializes the receivable guard rejection as HTTP 422 with the remediation text", async () => {
      const repo = new PrismaReceivablesRepository(arDb());
      const edited = rehydrateReceivable("OVERDUE").update({ description: "edit" });
      const error: unknown = await repo.update(edited).then(
        () => {
          throw new Error("expected rejection");
        },
        (e: unknown) => e,
      );
      const response = handleError(error);
      expect(response.status).toBe(422);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/OVERDUE.*DEC-A/s);
    });

    it("handleError serializes the payable guard rejection as HTTP 422 with the remediation text (sister)", async () => {
      const repo = new PrismaPayablesRepository(apDb());
      const edited = rehydratePayable("OVERDUE").update({ description: "edit" });
      const error: unknown = await repo.update(edited).then(
        () => {
          throw new Error("expected rejection");
        },
        (e: unknown) => e,
      );
      const response = handleError(error);
      expect(response.status).toBe(422);
      const body = (await response.json()) as { error: string };
      expect(body.error).toMatch(/OVERDUE.*DEC-A/s);
    });
  });

  describe("GREEN-GUARD (DEC-A1) — mapper stays total, branch preserved", () => {
    it("toSettlementStatus(OVERDUE) collapses to PENDING", () => {
      expect(toSettlementStatus("OVERDUE")).toBe("PENDING");
    });
  });
});

/* ────────────────────────────────────────────────────────────────────────────
 * STRUCTURAL SCAN (M-2, Batch 3-POLISH) — enumeration enforcement.
 *
 * The behavioral tests above assert the 6 KNOWN write sites per repository by
 * name; nothing above fails when a 7th unguarded write-method appears — the
 * same enumeration gap that produced F-1. This scan enforces the enumeration
 * itself, complementing __tests__/settlement-write-funnel.sentinel.test.ts
 * (which already blocks delegate/nested/raw aux writes OUTSIDE the two repos
 * across modules|app|lib) with exactly what it does not cover:
 *   (a) DEC-A guard pairing INSIDE the two repositories — every method that
 *       writes an aux table must guard the status (assertPersistableStatus /
 *       toPersistence) or write only a literal PENDING/VOIDED;
 *   (b) scripts/ — excluded from the funnel's SCAN_ROOTS (round-1 F-6): no
 *       new delegate write outside the explicit allowlist, allowlisted script
 *       writes stay status-free, and raw SQL touching the aux tables never
 *       assigns status.
 *
 * Scan helpers are deliberately duplicated per sentinel file so each sentinel
 * stays self-contained (precedent: the funnel sentinel mirrors
 * feature-boundaries.test.ts). Comment lines are BLANKED whole-line only —
 * never span-stripped (see the funnel sentinel's HAZARDS note). Per
 * [[sentinel_regex_line_bound]] within-line spans are `[^\n]*`; no
 * paren-classes. Checks are CONSERVATIVE: a false RED names its offender and
 * is triaged by a human; a silent MISS is not.
 *
 * Declared failure mode: BORN-GREEN cementación. RED-ability proven by
 * mutation-check at ship time:
 *   (a) `assertPersistableStatus(status)` removed from one repo write-method
 *       → GUARD-PAIRING REDs naming the method; reverted.
 *   (b) stray `accountsReceivable.updateMany({ data: { status: … } })` added
 *       to a script → scripts-allowlist RED naming file:line; reverted.
 * ──────────────────────────────────────────────────────────────────────── */

const REPO_ROOT = path.resolve(__dirname, "../../../..");

const STRUCT_SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "coverage",
  "dist",
  "build",
  ".turbo",
  ".vercel",
]);

/** The only files allowed to write aux-table rows (funnel allowlist). */
const GUARDED_REPO_FILES: ReadonlyArray<string> = [
  "modules/receivables/infrastructure/prisma-receivables.repository.ts",
  "modules/payables/infrastructure/prisma-payables.repository.ts",
];

/** Scripts allowed a delegate aux write — must stay status-free (asserted). */
const SCRIPT_WRITE_ALLOWLIST: ReadonlyArray<string> = [
  "scripts/backfill-ar-description.ts",
];

const AUX_DELEGATE_WRITE_RE =
  /\b(?:accountsReceivable|accountsPayable)\s*\.\s*(?:create|createMany|update|updateMany|updateManyAndReturn|upsert)\s*\(/g;

/** Status guarded in-method: boundary assert or the guarding mapper. */
const GUARD_CALL_RE = /\b(?:assertPersistableStatus|toPersistence)\s*\(/;

/** Literal-only status write (createTx's local const / voidTx's data key). */
const LITERAL_STATUS_RE =
  /\bstatus(?:\s*:\s*(?:ReceivableStatus|PayableStatus))?\s*[:=]\s*"(?:PENDING|VOIDED)"/;

/** Any status write/filter token — allowlisted scripts must have NONE. */
const STATUS_TOKEN_RE = /\bstatus\b\s*[:=]/;

const STRUCT_RAW_SQL_RE =
  /\$(?:executeRaw|queryRaw|executeRawUnsafe|queryRawUnsafe)\b/;

const STRUCT_AUX_TABLE_RE = /accounts_?receivable|accounts_?payable/i;

/**
 * SQL status assignment (`SET … status = …`). Also matches a TS `status =`
 * or a `WHERE status =` in a raw-SQL aux file — conservative by design.
 */
const SQL_STATUS_ASSIGN_RE = /["'\s]status["']?\s*=[^=]/i;

/** Write-methods each repository must expose today (vacuity floor). */
const STRUCT_MIN_WRITE_METHODS = 6;

function structIsTestFile(relPath: string): boolean {
  const segments = relPath.split(path.sep);
  if (segments.includes("__tests__") || segments.includes("__mocks__")) return true;
  const base = segments[segments.length - 1];
  return /\.(test|spec)\.tsx?$/.test(base) || /\.fixtures?\.tsx?$/.test(base);
}

/** Blank whole comment lines, preserving line count (line-local; cannot delete code). */
function structBlankCommentLines(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      const trimmed = line.trimStart();
      return trimmed.startsWith("//") ||
        trimmed.startsWith("*") ||
        trimmed.startsWith("/*")
        ? ""
        : line;
    })
    .join("\n");
}

function structLineOfIndex(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (src[i] === "\n") line++;
  return line;
}

function structListSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (STRUCT_SKIP_DIRS.has(entry.name)) continue;
      structListSourceFiles(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

interface StructFile {
  readonly rel: string;
  readonly code: string; // comment-blanked
  readonly lines: string[]; // raw, for offender display
}

function structLoad(rel: string): StructFile {
  const raw = readFileSync(path.join(REPO_ROOT, rel), "utf8");
  return { rel, code: structBlankCommentLines(raw), lines: raw.split("\n") };
}

function structOffendersOf(file: StructFile, re: RegExp): string[] {
  const out: string[] = [];
  re.lastIndex = 0;
  for (let m = re.exec(file.code); m !== null; m = re.exec(file.code)) {
    const line = structLineOfIndex(file.code, m.index);
    out.push(`${file.rel}:${line}: ${(file.lines[line - 1] ?? "").trim()}`);
  }
  return out;
}

/**
 * Class-body method slices: header at exactly 2-space indent; body runs to
 * the next header, so nested callbacks stay inside their owning method.
 */
function structMethodSlices(code: string): Array<{ name: string; body: string }> {
  const headerRe = /^ {2}(?:private\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*[(<]/gm;
  const headers: Array<{ name: string; index: number }> = [];
  for (let m = headerRe.exec(code); m !== null; m = headerRe.exec(code)) {
    headers.push({ name: m[1], index: m.index });
  }
  return headers.map((h, i) => ({
    name: h.name,
    body: code.slice(h.index, headers[i + 1]?.index ?? code.length),
  }));
}

const scriptFiles: StructFile[] = structListSourceFiles(
  path.join(REPO_ROOT, "scripts"),
)
  .map((abs) => path.relative(REPO_ROOT, abs))
  .filter((rel) => !structIsTestFile(rel))
  .map(structLoad);

describe("α-sentinel — OVERDUE write-site enumeration is enforced, not assumed (M-2)", () => {
  it("scripts scan covers the known script files (smoke)", () => {
    // Guards against the walk silently scanning zero files (~9 today).
    expect(scriptFiles.length).toBeGreaterThan(3);
  });

  for (const rel of GUARDED_REPO_FILES) {
    it(`GUARD-PAIRING: every aux write-method in ${path.basename(rel)} guards status or writes a literal`, () => {
      const file = structLoad(rel);
      const writeMethods = structMethodSlices(file.code).filter((s) => {
        AUX_DELEGATE_WRITE_RE.lastIndex = 0;
        return AUX_DELEGATE_WRITE_RE.test(s.body);
      });
      // Vacuity floor: slicing gone wrong must fail loudly.
      expect(
        writeMethods.length,
        `${rel}: write-method slicing found too few methods`,
      ).toBeGreaterThanOrEqual(STRUCT_MIN_WRITE_METHODS);

      const unguarded = writeMethods
        .filter((s) => !GUARD_CALL_RE.test(s.body) && !LITERAL_STATUS_RE.test(s.body))
        .map((s) => `${rel} :: ${s.name}`);
      // A new write-method must either call assertPersistableStatus /
      // toPersistence or write only literal PENDING/VOIDED — never a
      // caller-supplied status unchecked (DEC-A).
      expect(unguarded).toEqual([]);
    });
  }

  it("scripts/: no aux delegate write outside the explicit allowlist", () => {
    const offenders = scriptFiles
      .filter((f) => !SCRIPT_WRITE_ALLOWLIST.includes(f.rel))
      .flatMap((f) => structOffendersOf(f, AUX_DELEGATE_WRITE_RE));
    // Route new aux writes through the repositories (funnel invariant) — do
    // NOT extend the allowlist to make a status write pass.
    expect(offenders).toEqual([]);
  });

  it("scripts/: allowlisted delegate writes stay status-free", () => {
    for (const rel of SCRIPT_WRITE_ALLOWLIST) {
      const file = scriptFiles.find((f) => f.rel === rel);
      expect(file, `allowlisted script missing from scan: ${rel}`).toBeDefined();
      // backfill-ar-description writes `description` only; ANY status token
      // appearing here (even a where-filter) demands human review.
      expect(structOffendersOf(file!, new RegExp(STATUS_TOKEN_RE, "g"))).toEqual([]);
    }
  });

  it("scripts/: raw SQL touching the aux tables never assigns status", () => {
    const offenders = scriptFiles
      .filter(
        (f) =>
          STRUCT_RAW_SQL_RE.test(f.code) &&
          STRUCT_AUX_TABLE_RE.test(f.code) &&
          SQL_STATUS_ASSIGN_RE.test(f.code),
      )
      .map((f) => f.rel);
    // The sourceTypeCode backfills legitimately raw-UPDATE the aux tables —
    // they must never gain a `status =` assignment ($executeRaw bypasses
    // every TS-level guard).
    expect(offenders).toEqual([]);
  });
});

/**
 * FILTER closure (Batch 4) — SEPARATE, independently revertible decision.
 *
 * Unlike everything above (Marco's DEC-A, write surface), this block cements
 * an ORCHESTRATOR-derived decision (premise-verification, item [2]): the
 * filter enums (`receivableFiltersSchema` / `payableFiltersSchema`) also drop
 * "OVERDUE". Rationale: those enums do not enumerate the DB enum — CANCELLED
 * is already absent from them — so what they actually reflect is WRITABLE
 * states; with OVERDUE unwritable, `GET ?status=OVERDUE` could only ever
 * return an empty list while implying the state exists. Zero callers send it.
 * Effect: `GET ?status=OVERDUE` now 400s (ZodError → handleError → 400)
 * instead of 200-with-empty-list.
 *
 * Reverting the Batch 4 commit alone removes this whole block AND the filter
 * imports AND restores the enums — without touching DEC-A's write closure.
 *
 * Declared RED failure mode (pre-Batch 4): the two rejection tests fail with
 * "expected true to be false" — the filter enums still parse "OVERDUE".
 */
describe("α-sentinel — OVERDUE filter closure (orchestrator-derived, Batch 4)", () => {
  it("receivableFiltersSchema rejects status OVERDUE", () => {
    expect(receivableFiltersSchema.safeParse({ status: "OVERDUE" }).success).toBe(false);
  });

  it("payableFiltersSchema rejects status OVERDUE", () => {
    expect(payableFiltersSchema.safeParse({ status: "OVERDUE" }).success).toBe(false);
  });

  it.each(["PENDING", "PARTIAL", "PAID", "VOIDED"] as const)(
    "positive control (born-green): filter schemas still accept %s",
    (status) => {
      expect(receivableFiltersSchema.safeParse({ status }).success).toBe(true);
      expect(payableFiltersSchema.safeParse({ status }).success).toBe(true);
    },
  );

  it("positive control (born-green): status stays optional — filters parse without it", () => {
    expect(receivableFiltersSchema.safeParse({ contactId: "c-1" }).success).toBe(true);
    expect(payableFiltersSchema.safeParse({}).success).toBe(true);
  });
});
