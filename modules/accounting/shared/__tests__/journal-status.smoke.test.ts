/**
 * Smoke test for FIN-1 helper module.
 *
 * Asserts:
 * 1. `FINALIZED_JE_STATUSES` exports the canonical readonly tuple ['POSTED','LOCKED'].
 * 2. JSDoc canonical block contains the literal text `CANONICAL RULE: FIN-1` (greppable).
 * 3. `FINALIZED_JE_STATUSES_SQL` is a `Prisma.Sql` fragment that renders `IN ('POSTED','LOCKED')`.
 *
 * RED failure mode: import throws MODULE_NOT_FOUND on first run (files do not exist yet).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { Prisma } from "@/generated/prisma/client";
import { FINALIZED_JE_STATUSES } from "../domain/journal-status";
import { FINALIZED_JE_STATUSES_SQL } from "../infrastructure/journal-status.sql";

describe("FIN-1 helper module — smoke", () => {
  it("exports FINALIZED_JE_STATUSES tuple ['POSTED','LOCKED']", () => {
    expect(FINALIZED_JE_STATUSES).toEqual(["POSTED", "LOCKED"]);
    // Tuple is readonly — runtime check is the deep-equal above; the readonly
    // const assertion is a compile-time guarantee enforced by tsc.
    expect(FINALIZED_JE_STATUSES.length).toBe(2);
  });

  it("contains literal text CANONICAL RULE: FIN-1 in source", () => {
    const sourcePath = path.resolve(
      __dirname,
      "..",
      "domain",
      "journal-status.ts",
    );
    const source = readFileSync(sourcePath, "utf8");
    expect(source).toContain("CANONICAL RULE: FIN-1");
  });

  it("SQL fragment renders IN ('POSTED','LOCKED')", () => {
    expect(FINALIZED_JE_STATUSES_SQL).toBeInstanceOf(Prisma.Sql);
    // Render the fragment via Prisma.sql template tag interpolation to a
    // string we can assert against. Prisma.Sql exposes `.sql` (the template
    // body) and `.values` (the params). For a literal IN-clause with no
    // params, `.sql` is the full rendered text.
    expect(FINALIZED_JE_STATUSES_SQL.sql).toBe("IN ('POSTED','LOCKED')");
    expect(FINALIZED_JE_STATUSES_SQL.values).toEqual([]);
  });
});
