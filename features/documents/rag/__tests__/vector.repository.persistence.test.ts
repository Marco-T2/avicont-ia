/**
 * REQ-35 — VectorRepository.storeChunks persists sectionPath; searchSimilar
 * returns it through the JOIN.
 *
 * Unit-level: BaseRepository accepts a PrismaClient via constructor, so we
 * inject a fake db whose `$queryRawUnsafe` captures every (sql, params) pair.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - SCN-35.persistence: the captured INSERT params for sectionPath are
 *     absent (current signature has no sectionPath slot, params end at the
 *     embedding vector); assertion that params contain the chunker-emitted
 *     section string FAILS.
 *   - SCN-30.sectionPath-return: the SELECT clause does NOT include
 *     `dc."sectionPath"` so a row returned with sectionPath populated by
 *     the JOIN cannot exist — assertion on the captured SQL FAILS first.
 *
 * Real pgvector integration is out-of-scope (covered by test-db convention).
 */

import { describe, it, expect, vi } from "vitest";
import { VectorRepository } from "../vector.repository";

interface RawCall {
  sql: string;
  params: unknown[];
}

function makeFakeDb(rows: unknown[] = []) {
  const calls: RawCall[] = [];
  const fake = {
    $queryRawUnsafe: vi.fn(async (sql: string, ...params: unknown[]) => {
      calls.push({ sql, params });
      return rows;
    }),
  };
  return { fake, calls };
}

describe("REQ-35 — VectorRepository.storeChunks persists sectionPath", () => {
  it("INSERT contains sectionPath column and passes it as a bound param", async () => {
    const { fake, calls } = makeFakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    await repo.storeChunks([
      {
        documentId: "doc-1",
        organizationId: "org-1",
        scope: "ORGANIZATION" as never,
        content: "snippet body",
        chunkIndex: 0,
        sectionPath: "ACME > Plan > 1.01 ACTIVO",
        embedding: [0.1, 0.2, 0.3],
      },
    ]);

    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0];
    // SQL must reference the new column explicitly.
    expect(sql).toMatch(/"sectionPath"/);
    // Param value must equal the chunker-emitted section string —
    // parametrized (no SQL-injection via interpolation).
    expect(params).toContain("ACME > Plan > 1.01 ACTIVO");
  });

  it("forwards NULL sectionPath unchanged (no detector match path)", async () => {
    const { fake, calls } = makeFakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    await repo.storeChunks([
      {
        documentId: "doc-2",
        organizationId: "org-1",
        scope: "ORGANIZATION" as never,
        content: "unstructured body",
        chunkIndex: 0,
        sectionPath: null,
        embedding: [0.1, 0.2, 0.3],
      },
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].params).toContain(null);
  });
});

describe("REQ-30/35 — searchSimilar returns sectionPath via JOIN", () => {
  it("SELECT includes dc.sectionPath", async () => {
    const { fake, calls } = makeFakeDb([
      {
        content: "snippet",
        documentId: "doc-1",
        score: 0.9,
        documentName: "Plan de Cuentas",
        chunkIndex: 0,
        sectionPath: "ACME > Plan",
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    await repo.searchSimilar([0.1, 0.2], "org-1", ["ORGANIZATION"] as never, 5);

    expect(calls).toHaveLength(1);
    const { sql } = calls[0];
    expect(sql).toMatch(/dc\."sectionPath"/);
  });

  it("returned rows expose sectionPath on each result", async () => {
    const { fake } = makeFakeDb([
      {
        content: "first",
        documentId: "doc-1",
        score: 0.91,
        documentName: "Plan de Cuentas",
        chunkIndex: 0,
        sectionPath: "Capítulo 1",
      },
      {
        content: "second",
        documentId: "doc-2",
        score: 0.82,
        documentName: "Reglamento Avícola",
        chunkIndex: 7,
        sectionPath: null,
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
    expect(out[0].sectionPath).toBe("Capítulo 1");
    expect(out[1].sectionPath).toBeNull();
  });
});
