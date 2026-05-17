/**
 * REQ-43 — VectorRepository.searchSimilar applies AND-semantics tag filter.
 *
 * Implementation: when `tagIds` is non-empty, the SQL must
 *  (a) INNER JOIN document_tags dt ON dt."documentId" = d.id
 *  (b) WHERE dt."tagId" IN (...)
 *  (c) GROUP BY chunk-uniqueness columns
 *  (d) HAVING COUNT(DISTINCT dt."tagId") = <provided count>
 *
 * Unit-level test injects a fake `$queryRawUnsafe` and asserts the captured
 * SQL string contains the JOIN/WHERE/HAVING tokens (in the tag-filtered
 * variant) and does NOT contain them in the back-compat (no-tags) variant.
 * Locks BOTH directions to prevent silent regressions.
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   - Before Commit D, `tagIds?` parameter is accepted but ignored — SQL is
 *     identical in both branches. The `tags filter active` test fails
 *     because the SQL does NOT contain `JOIN "document_tags"`.
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

describe("REQ-43 — VectorRepository.searchSimilar AND-semantics tag filter", () => {
  it("SCN-43.1: omitted/empty tagIds keeps the existing single-query shape (no JOIN document_tags, no HAVING)", async () => {
    const { fake, calls } = makeFakeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    await repo.searchSimilar([0.1, 0.2], "org-1", ["ORGANIZATION"] as never, 5);

    expect(calls).toHaveLength(1);
    const sql = calls[0].sql;
    expect(sql).not.toMatch(/JOIN\s+"document_tags"/i);
    expect(sql).not.toMatch(/HAVING/i);
  });

  it("SCN-43.1 α2: empty array also short-circuits (no JOIN, no HAVING)", async () => {
    const { fake, calls } = makeFakeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    await repo.searchSimilar([0.1, 0.2], "org-1", ["ORGANIZATION"] as never, 5, []);

    expect(calls).toHaveLength(1);
    const sql = calls[0].sql;
    expect(sql).not.toMatch(/JOIN\s+"document_tags"/i);
    expect(sql).not.toMatch(/HAVING/i);
  });

  it("SCN-43.3: AND-semantics — tagIds = [a, b] emits INNER JOIN document_tags + HAVING COUNT(DISTINCT tagId) = 2", async () => {
    const { fake, calls } = makeFakeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    await repo.searchSimilar(
      [0.1, 0.2],
      "org-1",
      ["ORGANIZATION"] as never,
      5,
      ["tag-a-id", "tag-b-id"],
    );

    expect(calls).toHaveLength(1);
    const sql = calls[0].sql;
    expect(sql).toMatch(/JOIN\s+"document_tags"/i);
    expect(sql).toMatch(/HAVING\s+COUNT\s*\(\s*DISTINCT[^)]*"tagId"[^)]*\)\s*=\s*2/i);
  });

  it("SCN-43.2: single-tag — HAVING COUNT(DISTINCT tagId) = 1", async () => {
    const { fake, calls } = makeFakeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    await repo.searchSimilar(
      [0.1, 0.2],
      "org-1",
      ["ORGANIZATION"] as never,
      5,
      ["tag-a-id"],
    );

    const sql = calls[0].sql;
    expect(sql).toMatch(/JOIN\s+"document_tags"/i);
    expect(sql).toMatch(/HAVING\s+COUNT\s*\(\s*DISTINCT[^)]*"tagId"[^)]*\)\s*=\s*1/i);
  });

  it("α-SQL-injection sentinel: tagIds are passed as parametrized placeholders, NOT interpolated into the SQL string", async () => {
    const { fake, calls } = makeFakeDb([]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = new VectorRepository(fake as any);

    const malicious = "tag-a'; DROP TABLE documents; --";
    await repo.searchSimilar(
      [0.1, 0.2],
      "org-1",
      ["ORGANIZATION"] as never,
      5,
      [malicious, "tag-b"],
    );

    const { sql, params } = calls[0];
    // SQL string itself must NOT contain the malicious literal — it must
    // travel as a parameter.
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain(malicious);
    expect(params).toContain(malicious);
    expect(params).toContain("tag-b");
  });
});
