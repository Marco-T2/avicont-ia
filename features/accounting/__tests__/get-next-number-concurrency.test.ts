/**
 * T3.2 RED → T3.5 GREEN
 * REQ-B.2 — `JournalRepository.createWithRetryTx` is race-safe:
 *   - Reads current max inside the tx
 *   - Attempts INSERT; on P2002 (unique constraint on
 *     `organizationId_voucherTypeId_periodId_number`) retries up to 5×
 *   - After 5 failed attempts, throws VOUCHER_NUMBER_CONTENTION
 *
 * B.2-S1a — single caller, no contention → 1 attempt
 * B.2-S1b — single caller, 2× P2002 then success → 3 attempts, returns entry
 * B.2-S1c — simulator w/ shared state + 5 concurrent callers → distinct {1..5}
 *   (50-way integration is covered by DB-level tests — this unit checks the
 *   retry logic against a pathological mock scheduler where ALL callers read
 *   the empty state simultaneously; real Postgres serializes at the unique
 *   constraint boundary, so 5 callers × 5 retries is the worst-case budget.)
 * B.2-S2  — 5 P2002 in a row → throws VOUCHER_NUMBER_CONTENTION
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Observabilidad mínima de retry: spy sobre logStructured para asertar el
// evento journal_number_succeeded_after_retry cuando attempt > 0.
vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

import { JournalRepository } from "@/features/accounting/journal.repository";
import { VOUCHER_NUMBER_CONTENTION } from "@/features/shared/errors";
import { Prisma } from "@/generated/prisma/client";
import type { JournalLineInput } from "@/features/accounting/journal.types";
import { logStructured } from "@/lib/logging/structured";

beforeEach(() => {
  vi.mocked(logStructured).mockClear();
});

const ORG_ID = "org-contention";
const VT_ID = "vt-diario";
const PERIOD_ID = "period-abril";
const UNIQUE_INDEX = "organizationId_voucherTypeId_periodId_number";

const BASE_DATA = {
  date: new Date("2026-04-15T12:00:00Z"),
  description: "Test JE",
  periodId: PERIOD_ID,
  voucherTypeId: VT_ID,
  createdById: "user-1",
};

const TWO_LINES: JournalLineInput[] = [
  { accountId: "acc-1", debit: 100, credit: 0, order: 0 },
  { accountId: "acc-2", debit: 0, credit: 100, order: 1 },
];

// ── Helper: build a P2002 error identical to Prisma's ──
function p2002(target: string): Error {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: [target] },
  });
}

// ── Helper: build a mock `tx` with controllable findFirst + create ──
function buildTx(opts: {
  currentMax: number;
  createBehavior: Array<"success" | "p2002">;
}) {
  let assignedNumber = 0;
  const createdEntries: Array<{ number: number }> = [];
  const findFirst = vi
    .fn()
    .mockResolvedValue(opts.currentMax > 0 ? { number: opts.currentMax } : null);

  let callIndex = 0;
  const create = vi.fn(async (args: { data: { number: number } }) => {
    const behavior = opts.createBehavior[callIndex++] ?? "success";
    if (behavior === "p2002") throw p2002(UNIQUE_INDEX);
    assignedNumber = args.data.number;
    createdEntries.push({ number: args.data.number });
    return {
      id: `je-${assignedNumber}`,
      number: args.data.number,
      organizationId: ORG_ID,
      voucherTypeId: VT_ID,
      periodId: PERIOD_ID,
      date: args.data,
      description: "Test JE",
      status: "DRAFT",
      sourceType: null,
      sourceId: null,
      referenceNumber: null,
      contactId: null,
      createdById: "user-1",
      updatedById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lines: [],
      contact: null,
      voucherType: {
        id: VT_ID,
        organizationId: ORG_ID,
        code: "CD",
        name: "Diario",
        description: null,
        isActive: true,
        prefix: "D",
      },
    };
  });

  const tx = {
    journalEntry: { findFirst, create },
   
  } as any;
  return { tx, findFirst, create, getCreateCallCount: () => callIndex };
}

describe("JournalRepository.createWithRetryTx (REQ-B.2)", () => {
  it("B.2-S1a — no contention: single attempt, number = max+1", async () => {
    const { tx, create } = buildTx({
      currentMax: 7,
      createBehavior: ["success"],
    });
   
    const repo = new JournalRepository({} as any);

    const result = await repo.createWithRetryTx(
      tx,
      ORG_ID,
      BASE_DATA,
      TWO_LINES,
    );

    expect(result.number).toBe(8);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("B.2-S1b — 2× P2002 then success: 3 attempts total", async () => {
    const { tx, create, findFirst } = buildTx({
      currentMax: 0,
      createBehavior: ["p2002", "p2002", "success"],
    });
   
    const repo = new JournalRepository({} as any);

    const result = await repo.createWithRetryTx(
      tx,
      ORG_ID,
      BASE_DATA,
      TWO_LINES,
    );

    expect(create).toHaveBeenCalledTimes(3);
    expect(findFirst).toHaveBeenCalledTimes(3); // re-reads max each attempt
    expect(result.number).toBe(1); // mock findFirst always returns null → 1
  });

  it("B.2-S2 — 5× P2002 exhausts retries → throws VOUCHER_NUMBER_CONTENTION", async () => {
    const { tx, create } = buildTx({
      currentMax: 0,
      createBehavior: ["p2002", "p2002", "p2002", "p2002", "p2002"],
    });
   
    const repo = new JournalRepository({} as any);

    await expect(
      repo.createWithRetryTx(tx, ORG_ID, BASE_DATA, TWO_LINES),
    ).rejects.toMatchObject({
      code: VOUCHER_NUMBER_CONTENTION,
    });
    expect(create).toHaveBeenCalledTimes(5);
  });

  it("B.2-S2b — non-P2002 error is NOT retried, surfaces immediately", async () => {
    const boom = new Error("database down");
    const create = vi.fn().mockRejectedValue(boom);
    const findFirst = vi.fn().mockResolvedValue(null);
    const tx = {
      journalEntry: { findFirst, create },
   
    } as any;
   
    const repo = new JournalRepository({} as any);

    await expect(
      repo.createWithRetryTx(tx, ORG_ID, BASE_DATA, TWO_LINES),
    ).rejects.toBe(boom);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("B.2-OBS-1 — happy path (0 colisiones) NO emite log", async () => {
    const { tx } = buildTx({
      currentMax: 0,
      createBehavior: ["success"],
    });

    const repo = new JournalRepository({} as any);

    await repo.createWithRetryTx(tx, ORG_ID, BASE_DATA, TWO_LINES);

    expect(logStructured).not.toHaveBeenCalled();
  });

  it("B.2-OBS-2 — 2 colisiones + éxito emite journal_number_succeeded_after_retry con attempts=3", async () => {
    const { tx } = buildTx({
      currentMax: 0,
      createBehavior: ["p2002", "p2002", "success"],
    });

    const repo = new JournalRepository({} as any);

    await repo.createWithRetryTx(tx, ORG_ID, BASE_DATA, TWO_LINES);

    expect(logStructured).toHaveBeenCalledTimes(1);
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "journal_number_succeeded_after_retry",
        level: "info",
        orgId: ORG_ID,
        attempts: 3,
      }),
    );
  });

  it("B.2-OBS-3 — exhausting retries NO emite log (lo agarra el handler río arriba)", async () => {
    const { tx } = buildTx({
      currentMax: 0,
      createBehavior: ["p2002", "p2002", "p2002", "p2002", "p2002"],
    });

    const repo = new JournalRepository({} as any);

    await expect(
      repo.createWithRetryTx(tx, ORG_ID, BASE_DATA, TWO_LINES),
    ).rejects.toMatchObject({ code: VOUCHER_NUMBER_CONTENTION });

    expect(logStructured).not.toHaveBeenCalled();
  });

  it("B.2-S1c — 5 concurrent callers → distinct {1..5} (retry consumes contention)", async () => {
    // Shared state — every `tx` built by makeSharedTx() reads and writes to
    // the same `assigned` Set. This models the DB constraint check, with
    // retries driven by the same loop that runs against real Postgres.
    const assigned = new Set<number>();

    function makeSharedTx() {
      const findFirst = vi.fn(async () => {
        if (assigned.size === 0) return null;
        return { number: Math.max(...assigned) };
      });
      const create = vi.fn(async (args: { data: { number: number } }) => {
        const n = args.data.number;
        if (assigned.has(n)) throw p2002(UNIQUE_INDEX);
        assigned.add(n);
        return { id: `je-${n}`, number: n } as unknown as never;
      });
      return {
        journalEntry: { findFirst, create },
   
      } as any;
    }

   
    const repo = new JournalRepository({} as any);

    const N = 5;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        repo.createWithRetryTx(
          makeSharedTx(),
          ORG_ID,
          BASE_DATA,
          TWO_LINES,
        ),
      ),
    );

    const numbers = new Set(results.map((r) => r.number));
    expect(numbers.size).toBe(N);
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(N);
  });
});
