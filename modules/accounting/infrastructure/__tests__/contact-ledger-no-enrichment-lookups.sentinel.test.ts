/**
 * α-sentinel: contact-ledger enrichment adapters no longer do source-table
 * lookups (journal-physical-document Phase 5 simplification).
 *
 * Pre-change the receivables adapter did `sale.findMany` + `dispatch.findMany`,
 * the payables adapter did `purchase.findMany`, and the payments adapter
 * selected `operationalDocType` + `referenceNumber` — all to resolve the
 * "Tipo" + "Nº" columns of the contact-ledger view. Phase 5 denormalized
 * these onto the JE row, so the adapters now only surface live state
 * (status / dueDate / paymentMethod / bankAccountName / direction).
 *
 * Per [[sentinel_regex_line_bound]] uses [^\n]* (line-bound) in not.toMatch.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const RECEIVABLES_PATH = path.resolve(
  __dirname,
  "../prisma-receivables-contact-ledger.adapter.ts",
);
const PAYABLES_PATH = path.resolve(
  __dirname,
  "../prisma-payables-contact-ledger.adapter.ts",
);
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

describe("α-sentinel — contact-ledger adapters drop source-table lookups", () => {
  it("receivables adapter runtime does NOT call this.db.sale.findMany", () => {
    const src = stripComments(readFileSync(RECEIVABLES_PATH, "utf8"));
    expect(src).not.toMatch(/this\.db\.sale\.findMany/);
  });

  it("receivables adapter runtime does NOT call this.db.dispatch.findMany", () => {
    const src = stripComments(readFileSync(RECEIVABLES_PATH, "utf8"));
    expect(src).not.toMatch(/this\.db\.dispatch\.findMany/);
  });

  it("payables adapter runtime does NOT call this.db.purchase.findMany", () => {
    const src = stripComments(readFileSync(PAYABLES_PATH, "utf8"));
    expect(src).not.toMatch(/this\.db\.purchase\.findMany/);
  });

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
