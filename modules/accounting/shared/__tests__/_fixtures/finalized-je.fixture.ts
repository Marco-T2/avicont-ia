/**
 * Parametric FIN-1 fixture: seeds one POSTED + one LOCKED JournalEntry across
 * two periods, each with one balanced JournalLine pair on the same account.
 *
 * Consumed by 8 adapter RED tests (T-05..T-12). The shared shape lets each
 * adapter assert that LOCKED-period rows surface in the aggregate output
 * (the FIN-1 bug — `POSTED` literal silently drops the LOCKED row).
 *
 * Pre-condition: `periodLockedId` MUST point at a FiscalPeriod with
 * `status: "CLOSED"` (real DB integration tests). The fixture does NOT create
 * the periods — the consumer's `beforeAll` is responsible for that, mirroring
 * the existing convention in `equity-statement.repository.test.ts`.
 *
 * Cross-module-boundary spy ([[cross_module_boundary_spy]]): exported as a
 * named symbol from `modules/accounting/shared/__tests__/_fixtures/`; cross-
 * module consumers import via named-export — the SHIM-safe shape.
 */

// Minimal structural type of the Prisma client surface this fixture uses.
// We avoid coupling to `@/generated/prisma/client` so the self-test can pass
// a fake client; integration consumers pass the real `prisma` and it
// satisfies the same shape structurally.
type PrismaJeCreateInput = {
  organizationId: string;
  number: number;
  date: Date;
  description: string;
  status: "POSTED" | "LOCKED";
  periodId: string;
  voucherTypeId: string;
  createdById: string;
};

type PrismaJlCreateManyArg = {
  data: Array<{
    journalEntryId: string;
    accountId: string;
    debit: string;
    credit: string;
    order: number;
  }>;
};

export interface FixturePrismaClient {
  journalEntry: {
    create: (args: { data: PrismaJeCreateInput }) => Promise<{
      id: string;
      organizationId: string;
      status: "POSTED" | "LOCKED";
      periodId: string;
      [k: string]: unknown;
    }>;
  };
  journalLine: {
    createMany: (args: PrismaJlCreateManyArg) => Promise<{ count: number }>;
  };
}

export interface FinalizedJeFixtureCtx {
  orgId: string;
  accountId: string;
  voucherTypeId: string;
  createdById: string;
  periodPostedId: string; // FiscalPeriod with status OPEN
  periodLockedId: string; // FiscalPeriod with status CLOSED
  /** Defaults to `"100.00"`. Both JEs use the same amount so aggregates double cleanly. */
  debit?: string;
  /** Defaults to `"100.00"`. */
  credit?: string;
  /** Defaults to `2099-06-15` (matches existing test convention). */
  date?: Date;
  /** Optional: a contra-account id for the balancing line. Defaults to `accountId` (self-balance). */
  contraAccountId?: string;
  /** Optional: starting JE number for the POSTED entry (LOCKED gets +1). Defaults to a large constant unlikely to collide with other test seeds. */
  startingNumber?: number;
  /** Optional: description prefix. Default `"FIN-1 fixture"`. */
  descriptionPrefix?: string;
}

export interface FinalizedJeFixtureResult {
  posted: {
    id: string;
    organizationId: string;
    status: "POSTED";
    periodId: string;
  };
  locked: {
    id: string;
    organizationId: string;
    status: "LOCKED";
    periodId: string;
  };
}

export async function seedJournalEntriesAcrossStatuses(
  prisma: FixturePrismaClient,
  ctx: FinalizedJeFixtureCtx,
): Promise<FinalizedJeFixtureResult> {
  const debit = ctx.debit ?? "100.00";
  const credit = ctx.credit ?? "100.00";
  const date = ctx.date ?? new Date("2099-06-15T00:00:00Z");
  const contraAccountId = ctx.contraAccountId ?? ctx.accountId;
  const startingNumber = ctx.startingNumber ?? 90001;
  const prefix = ctx.descriptionPrefix ?? "FIN-1 fixture";

  const postedEntry = await prisma.journalEntry.create({
    data: {
      organizationId: ctx.orgId,
      number: startingNumber,
      date,
      description: `${prefix} — POSTED`,
      status: "POSTED",
      periodId: ctx.periodPostedId,
      voucherTypeId: ctx.voucherTypeId,
      createdById: ctx.createdById,
    },
  });

  await prisma.journalLine.createMany({
    data: [
      {
        journalEntryId: postedEntry.id,
        accountId: ctx.accountId,
        debit,
        credit: "0",
        order: 0,
      },
      {
        journalEntryId: postedEntry.id,
        accountId: contraAccountId,
        debit: "0",
        credit,
        order: 1,
      },
    ],
  });

  const lockedEntry = await prisma.journalEntry.create({
    data: {
      organizationId: ctx.orgId,
      number: startingNumber + 1,
      date,
      description: `${prefix} — LOCKED`,
      status: "LOCKED",
      periodId: ctx.periodLockedId,
      voucherTypeId: ctx.voucherTypeId,
      createdById: ctx.createdById,
    },
  });

  await prisma.journalLine.createMany({
    data: [
      {
        journalEntryId: lockedEntry.id,
        accountId: ctx.accountId,
        debit,
        credit: "0",
        order: 0,
      },
      {
        journalEntryId: lockedEntry.id,
        accountId: contraAccountId,
        debit: "0",
        credit,
        order: 1,
      },
    ],
  });

  return {
    posted: {
      id: postedEntry.id,
      organizationId: postedEntry.organizationId,
      status: "POSTED",
      periodId: postedEntry.periodId,
    },
    locked: {
      id: lockedEntry.id,
      organizationId: lockedEntry.organizationId,
      status: "LOCKED",
      periodId: lockedEntry.periodId,
    },
  };
}
