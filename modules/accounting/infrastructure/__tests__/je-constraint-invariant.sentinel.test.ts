/**
 * α-sentinel: JournalEntry unique constraint invariant (journal-physical-document).
 *
 * After Phase 1 the @@unique([organizationId, voucherTypeId, referenceNumber])
 * constraint is GONE — replaced by @@unique([organizationId,
 * operationalDocTypeId, referenceNumber]). This sentinel pins both the
 * schema and the repo file shape so a future change can't silently
 * reintroduce the old shape.
 *
 * Per [[sentinel_regex_line_bound]] the not.toMatch regex uses [^\n]*
 * (line-bound) instead of [^)]* to avoid false negatives on nested-paren
 * expressions in the schema (e.g. `@relation(fields: [...], references: [...])`
 * later in the file).
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.resolve(__dirname, "../../../../prisma/schema.prisma");
const REPO_PATH = path.resolve(__dirname, "../prisma-journal-entries.repo.ts");

describe("α-sentinel — JournalEntry unique constraint invariant", () => {
  it("schema NO longer declares @@unique on (voucherTypeId, referenceNumber)", () => {
    const sql = readFileSync(SCHEMA_PATH, "utf8");
    // The OLD constraint: `@@unique([organizationId, voucherTypeId, referenceNumber])`.
    // Use line-bound regex so we only catch a literal redeclaration.
    expect(sql).not.toMatch(
      /^[^\n]*@@unique\(\[organizationId, voucherTypeId, referenceNumber\][^\n]*$/m,
    );
  });

  it("schema declares @@unique on (operationalDocTypeId, referenceNumber) (post-Phase-1)", () => {
    const sql = readFileSync(SCHEMA_PATH, "utf8");
    expect(sql).toMatch(
      /@@unique\(\[organizationId, operationalDocTypeId, referenceNumber\]/,
    );
  });

  it("journalIncludeLines eager-hydrates operationalDocType (post-Phase-5)", () => {
    const src = readFileSync(REPO_PATH, "utf8");
    expect(src).toMatch(/operationalDocType:\s*true/);
  });

  it("createWithRetryTx forwards data.operationalDocTypeId into Prisma create.data", () => {
    const src = readFileSync(REPO_PATH, "utf8");
    expect(src).toMatch(/operationalDocTypeId:\s*data\.operationalDocTypeId\s*\?\?\s*null/);
  });
});
