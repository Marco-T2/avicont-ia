/**
 * α-sentinel: the surviving contact-ledger enrichment adapter (payments) no
 * longer does source-table lookups (journal-physical-document Phase 5
 * simplification).
 *
 * Pre-change the payments adapter selected `operationalDocType` +
 * `referenceNumber` to resolve the "Tipo" + "Nº" columns of the
 * contact-ledger view. Phase 5 denormalized these onto the JE row, so the
 * adapter now only surfaces live state (paymentMethod / bankAccountName /
 * direction).
 *
 * unified-comprobante-source-of-truth P9 (D6 retirement 3→1): the
 * receivables + payables enrichment adapters this sentinel also covered
 * (`prisma-receivables-contact-ledger.adapter.ts`,
 * `prisma-payables-contact-ledger.adapter.ts`) were DELETED — estado/dueDate
 * are read off the JE row (`JournalEntry.paymentStatus` / `.dueDate`).
 * Their file-read assertions were removed WITH the deletion (same commit,
 * per mock-target-rewrite discipline — a sentinel reading a deleted file is
 * an ENOENT, not a pass).
 *
 * Per [[sentinel_regex_line_bound]] uses [^\n]* (line-bound) in not.toMatch.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const PAYMENTS_PATH = path.resolve(
  __dirname,
  "../prisma-payments-contact-ledger.adapter.ts",
);

// Strip block + line comments so the sentinel pins RUNTIME code only —
// JSDoc references describing what was removed are legitimate documentation.
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

describe("α-sentinel — contact-ledger payments adapter drops source-table lookups", () => {
  it("payments adapter runtime does NOT select operationalDocType in the Prisma select", () => {
    const src = stripComments(readFileSync(PAYMENTS_PATH, "utf8"));
    // The previous select had `operationalDocType: { select: { code: true } }`.
    // Match the runtime select shape, not any incidental identifier mention.
    expect(src).not.toMatch(/operationalDocType:\s*\{\s*select/);
  });

  it("payments adapter runtime does NOT include referenceNumber in the select", () => {
    const src = stripComments(readFileSync(PAYMENTS_PATH, "utf8"));
    // The previous select had `referenceNumber: true,` — match the
    // Prisma select-projection shape literal.
    expect(src).not.toMatch(/referenceNumber:\s*true/);
  });
});
