/**
 * T3.1 RED → T3.5 GREEN
 * REQ-B.1 — `JournalRepository.getNextNumber` remains the preview-only helper.
 *
 * B.1-S1 first entry (no prior JE) → 1
 * B.1-S2 third entry in same {org, type, period} → 3
 * B.1-S3 independent sequence per {voucherType, period}
 * B.1-S4 resets across periods
 */

import { describe, it, expect, vi } from "vitest";
import { JournalRepository } from "@/features/accounting/journal.repository";

const ORG_ID = "org-next-number";

function buildRepo(prior: { number: number } | null) {
  const mockFindFirst = vi.fn().mockResolvedValue(prior);
  const mockDb = {
    journalEntry: { findFirst: mockFindFirst },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return {
    repo: new JournalRepository(mockDb),
    mockFindFirst,
  };
}

describe("JournalRepository.getNextNumber (REQ-B.1)", () => {
  it("B.1-S1 — fresh {org, type, period} → 1", async () => {
    const { repo } = buildRepo(null);
    const n = await repo.getNextNumber(ORG_ID, "vt-1", "period-1");
    expect(n).toBe(1);
  });

  it("B.1-S2 — third entry in same {org, type, period} → 3", async () => {
    const { repo } = buildRepo({ number: 2 });
    const n = await repo.getNextNumber(ORG_ID, "vt-1", "period-1");
    expect(n).toBe(3);
  });

  it("B.1-S3 — findFirst scoped to {org, voucherType, period}", async () => {
    const { repo, mockFindFirst } = buildRepo(null);
    await repo.getNextNumber(ORG_ID, "vt-diario", "period-abril");
    const args = mockFindFirst.mock.calls[0][0];
    expect(args.where).toMatchObject({
      organizationId: ORG_ID,
      voucherTypeId: "vt-diario",
      periodId: "period-abril",
    });
    expect(args.orderBy).toEqual({ number: "desc" });
  });

  it("B.1-S4 — independent sequences: different period returns its own last+1", async () => {
    // Simulate: April has 15 JEs for vt-1, May has 0.
    const { repo, mockFindFirst } = buildRepo(null);
    mockFindFirst
      .mockResolvedValueOnce({ number: 15 }) // April
      .mockResolvedValueOnce(null); // May (different period)

    const nApril = await repo.getNextNumber(ORG_ID, "vt-1", "period-april");
    const nMay = await repo.getNextNumber(ORG_ID, "vt-1", "period-may");

    expect(nApril).toBe(16);
    expect(nMay).toBe(1);
  });
});
