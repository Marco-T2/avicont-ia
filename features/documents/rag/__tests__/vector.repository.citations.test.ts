/**
 * REQ-30 — VectorRepository.searchSimilar enriches results with
 * documentName + chunkIndex by JOINing document_chunks → documents.
 *
 * Unit-level: BaseRepository accepts a PrismaClient via constructor, so we
 * inject a fake db whose `$queryRawUnsafe` returns the JOINed row shape and
 * we assert (a) the emitted SQL contains the JOIN, (b) the result objects
 * carry `documentName` + `chunkIndex` straight from the row.
 *
 * Real pgvector integration is covered by the existing test-db convention
 * (out-of-scope here; would require a live DB connection).
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - assertion failure: returned rows lack `documentName` (current SELECT
 *     only emits content/documentId/score) AND the captured SQL string does
 *     NOT include `JOIN "documents"`.
 */

import { describe, it, expect, vi } from "vitest";
import { VectorRepository } from "../vector.repository";

interface RawCall {
  sql: string;
  params: unknown[];
}

function makeFakeDb(rows: unknown[]) {
  const calls: RawCall[] = [];
  const fake = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      calls.push({ sql, params });
      return rows;
    }),
  };
  return { fake, calls };
}

describe("REQ-30 — VectorRepository.searchSimilar emits documentName + chunkIndex via JOIN", () => {
  it("SCN-30.1 α1: SELECT clause includes d.name AS documentName + dc.chunkIndex", async () => {
    const { fake, calls } = makeFakeDb([
      {
        content: "snippet",
        documentId: "doc-1",
        score: 0.9,
        documentName: "Plan de Cuentas",
        chunkIndex: 3,
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    await repo.searchSimilar([0.1, 0.2], "org-1", ["ORGANIZATION"] as never, 5);

    expect(calls).toHaveLength(1);
    const sql = calls[0].sql;
    // JOIN documents to pull name.
    expect(sql).toMatch(/JOIN\s+"documents"/i);
    // Select chunkIndex + name explicitly.
    expect(sql).toMatch(/"chunkIndex"/);
    expect(sql).toMatch(/"name"\s+AS\s+"documentName"/i);
  });

  it("SCN-30.1 α2: returned rows expose documentName + chunkIndex on each result", async () => {
    const { fake } = makeFakeDb([
      {
        content: "first",
        documentId: "doc-1",
        score: 0.91,
        documentName: "Plan de Cuentas",
        chunkIndex: 0,
      },
      {
        content: "second",
        documentId: "doc-2",
        score: 0.82,
        documentName: "Reglamento Avícola",
        chunkIndex: 7,
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    const out = await repo.searchSimilar(
      [0.1, 0.2],
      "org-1",
      ["ORGANIZATION"] as never,
      5,
    );

    expect(out).toHaveLength(2);
    expect(out[0].documentName).toBe("Plan de Cuentas");
    expect(out[0].chunkIndex).toBe(0);
    expect(out[1].documentName).toBe("Reglamento Avícola");
    expect(out[1].chunkIndex).toBe(7);
  });
});
