/**
 * Phase 1.4 — annual_close migration backfill semantics verification.
 *
 * The annual_close migration (20260516030000) backfills one fiscal_years row
 * per distinct (organizationId, year) in fiscal_periods, with:
 *   status = CLOSED iff COUNT(*)=12 AND COUNT(*) FILTER (status='CLOSED')=12
 *          else OPEN
 * (spec REQ-1.3 — conservative semantics, design OQ #4).
 *
 * The historical backfill already ran when the migration applied. The CLOSED
 * branch of the CASE is NOT covered by current dev-DB data (no org has 12
 * periods all CLOSED). To exercise both branches we replay the EXACT CASE
 * expression from the migration as a pure SELECT against an in-query VALUES
 * fixture — no INSERT/DELETE on real tables, no audit_logs side effects, no
 * NOT NULL FK collisions with the existing fiscal_periods schema.
 *
 * Fixtures (REQ-1.3 scenarios):
 *   Fixture A — 12 periods all CLOSED for year 2024 → status='CLOSED'
 *   Fixture B — 6 periods (3 CLOSED + 3 OPEN) for year 2025 → status='OPEN'
 *   Fixture C — 12 periods (11 CLOSED + 1 OPEN) for year 2024 → status='OPEN'
 *               (boundary: full-year count met but one is OPEN — must NOT
 *                qualify as CLOSED per the conservative AND clause)
 *   Fixture D — 12 periods all CLOSED but for two different orgs:
 *               must produce TWO rows (one per org), both CLOSED
 *               (proves the GROUP BY org boundary)
 *
 * The historical-data sanity check (last test) asserts that every row in the
 * real fiscal_years table has its status set to the value the CASE expression
 * would compute for its underlying fiscal_periods — proving the migration's
 * backfill matches the spec end-to-end on production-shape data.
 */
import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";

type BackfillRow = {
  org: string;
  year: number;
  status: "OPEN" | "CLOSED";
};

/**
 * Replay the backfill CASE expression against an in-query VALUES table.
 * Mirrors line-for-line the SELECT inside 20260516030000_annual_close
 * migration step 4 (the INSERT INTO fiscal_years … SELECT … FROM fiscal_periods).
 */
async function runBackfillCase(
  fixtures: ReadonlyArray<{
    org: string;
    year: number;
    status: "OPEN" | "CLOSED";
  }>,
): Promise<BackfillRow[]> {
  // Build a (org, year, status) VALUES literal. Vitest unit-level: stringly safe.
  const values = fixtures
    .map(
      (f) =>
        `('${f.org}', ${f.year}, '${f.status}'::"FiscalPeriodStatus")`,
    )
    .join(", ");
  const rows = await prisma.$queryRawUnsafe<
    Array<{ org: string; year: number; status: "OPEN" | "CLOSED" }>
  >(
    `SELECT
       fp."organizationId" AS org,
       fp."year"           AS year,
       CASE
         WHEN COUNT(*) = 12
           AND COUNT(*) FILTER (WHERE fp."status" = 'CLOSED') = 12
         THEN 'CLOSED'
         ELSE 'OPEN'
       END                  AS status
     FROM (VALUES ${values}) AS fp("organizationId", "year", "status")
     GROUP BY fp."organizationId", fp."year"
     ORDER BY fp."organizationId", fp."year"`,
  );
  return rows;
}

function repeat<T>(value: T, n: number): T[] {
  return new Array(n).fill(value);
}

describe("annual_close migration backfill semantics (REQ-1.3)", () => {
  it("Fixture A — 12 CLOSED periods for year 2024 → FiscalYear(2024) status=CLOSED", async () => {
    const fixtures = repeat("CLOSED" as const, 12).map((s, i) => ({
      org: "orgA",
      year: 2024,
      status: s,
      __m: i + 1,
    }));
    const rows = await runBackfillCase(fixtures);
    expect(rows).toEqual([{ org: "orgA", year: 2024, status: "CLOSED" }]);
  });

  it("Fixture B — 6 periods (3 CLOSED + 3 OPEN) for year 2025 → status=OPEN", async () => {
    const fixtures = [
      ...repeat("CLOSED" as const, 3),
      ...repeat("OPEN" as const, 3),
    ].map((s) => ({ org: "orgB", year: 2025, status: s }));
    const rows = await runBackfillCase(fixtures);
    expect(rows).toEqual([{ org: "orgB", year: 2025, status: "OPEN" }]);
  });

  it("Fixture C — 12 periods, 11 CLOSED + 1 OPEN → status=OPEN (conservative AND clause)", async () => {
    const fixtures = [
      ...repeat("CLOSED" as const, 11),
      "OPEN" as const,
    ].map((s) => ({ org: "orgC", year: 2024, status: s }));
    const rows = await runBackfillCase(fixtures);
    expect(rows).toEqual([{ org: "orgC", year: 2024, status: "OPEN" }]);
  });

  it("Fixture D — 12 CLOSED periods across two orgs → two rows, both CLOSED", async () => {
    const fixtures = [
      ...repeat("CLOSED" as const, 12).map((s) => ({
        org: "orgD1",
        year: 2024,
        status: s,
      })),
      ...repeat("CLOSED" as const, 12).map((s) => ({
        org: "orgD2",
        year: 2024,
        status: s,
      })),
    ];
    const rows = await runBackfillCase(fixtures);
    expect(rows).toEqual([
      { org: "orgD1", year: 2024, status: "CLOSED" },
      { org: "orgD2", year: 2024, status: "CLOSED" },
    ]);
  });

  it("historical data — every fiscal_years row matches the CASE-expression output for its underlying periods", async () => {
    // For every existing fiscal_years row, derive the expected status from
    // the LIVE fiscal_periods rows for the same (organizationId, year) and
    // assert it matches fiscal_years.status. Proves the migration's backfill
    // produced spec-correct status on production-shape data.
    const rows = await prisma.$queryRawUnsafe<
      Array<{
        organization_id: string;
        year: number;
        actual_status: "OPEN" | "CLOSED";
        expected_status: "OPEN" | "CLOSED";
      }>
    >(
      `SELECT fy."organizationId" AS organization_id,
              fy."year"            AS year,
              fy."status"          AS actual_status,
              CASE
                WHEN COUNT(fp.*) = 12
                  AND COUNT(*) FILTER (WHERE fp."status" = 'CLOSED') = 12
                THEN 'CLOSED'
                ELSE 'OPEN'
              END                  AS expected_status
       FROM "fiscal_years" fy
       LEFT JOIN "fiscal_periods" fp
         ON fp."organizationId" = fy."organizationId"
        AND fp."year"           = fy."year"
       GROUP BY fy."organizationId", fy."year", fy."status"`,
    );

    // Allow the assertion to skip orgs that have NO periods (LEFT JOIN, count=0
    // → would evaluate to OPEN, but the actual row might predate any periods.
    // In v1, no such row should exist because backfill only inserts when at
    // least one period exists, so equality should hold for ALL rows.)
    const drift = rows.filter((r) => r.actual_status !== r.expected_status);
    expect(drift).toEqual([]);
  });
});
