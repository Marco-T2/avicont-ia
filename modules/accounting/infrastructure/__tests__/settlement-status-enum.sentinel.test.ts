/**
 * α-sentinel: SettlementStatus enum invariant (unified-comprobante-source-of-truth, D5).
 *
 * COMPENSATING CONTROL for the schema task: pins that
 *  - `SettlementStatus` exists with EXACTLY {PENDING, PARTIAL, PAID, VOIDED}
 *    (no OVERDUE — unreachable: write surface rejects it (DEC-A), overdue is
 *    display-derived ATRASADO; no CANCELLED — legacy, mapped to VOIDED);
 *  - `JournalEntry.paymentStatus` is typed `SettlementStatus?` and NOT the
 *    existing `PaymentStatus` enum (INVARIANT COLLISION, locked: PaymentStatus
 *    = Payment DOCUMENT lifecycle DRAFT|POSTED|LOCKED|VOIDED, schema:580 —
 *    must never be reused for settlement state);
 *  - `JournalEntry.dueDate` is `DateTime?`;
 *  - `Payment.status` remains typed `PaymentStatus` unchanged.
 *
 * Member sets are parsed from schema.prisma (schema-scan, sister of
 * je-constraint-invariant.sentinel.test.ts). Per [[sentinel_regex_line_bound]]
 * every not.toMatch regex is line-bound (`[^\n]*`), never paren-class.
 *
 * Declared failure mode (pre-GREEN): SettlementStatus enum and the two
 * JournalEntry columns are absent from schema.prisma → the membership
 * toEqual and the field toMatch assertions FAIL. The PaymentStatus /
 * Payment.status pinning assertions describe CURRENT reality and are
 * born-green by design; their RED-ability is proven by mutation-check.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.resolve(__dirname, "../../../../prisma/schema.prisma");
const schema = readFileSync(SCHEMA_PATH, "utf8");

/** Extract the member identifiers of a Prisma enum block, or null if absent. */
function enumMembers(src: string, name: string): string[] | null {
  const block = src.match(new RegExp(`^enum ${name} \\{([\\s\\S]*?)^\\}`, "m"));
  if (!block) return null;
  return block[1]
    .split("\n")
    .map((line) => line.replace(/\/\/[^\n]*/, "").trim())
    .filter((line) => /^[A-Z][A-Z0-9_]*$/.test(line));
}

/** Extract a model block body, or null if absent. */
function modelBlock(src: string, name: string): string | null {
  const block = src.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m"));
  return block ? block[1] : null;
}

const je = modelBlock(schema, "JournalEntry") ?? "";
const payment = modelBlock(schema, "Payment") ?? "";

describe("α-sentinel — SettlementStatus enum invariant (D5)", () => {
  it("SettlementStatus enum exists with EXACTLY {PENDING, PARTIAL, PAID, VOIDED}", () => {
    expect(enumMembers(schema, "SettlementStatus")).toEqual([
      "PENDING",
      "PARTIAL",
      "PAID",
      "VOIDED",
    ]);
  });

  it("PaymentStatus (Payment doc lifecycle) stays untouched and member-set distinct", () => {
    const paymentStatus = enumMembers(schema, "PaymentStatus");
    expect(paymentStatus).toEqual(["DRAFT", "POSTED", "LOCKED", "VOIDED"]);
    expect(enumMembers(schema, "SettlementStatus")).not.toEqual(paymentStatus);
  });

  it("JournalEntry.paymentStatus is typed SettlementStatus? (nullable)", () => {
    expect(je).toMatch(/^\s*paymentStatus\s+SettlementStatus\?[^\n]*$/m);
  });

  it("JournalEntry.paymentStatus is NOT typed with the PaymentStatus doc-lifecycle enum", () => {
    expect(je).not.toMatch(/^\s*paymentStatus\s+PaymentStatus[^\n]*$/m);
  });

  it("JournalEntry.dueDate is typed DateTime? (nullable)", () => {
    expect(je).toMatch(/^\s*dueDate\s+DateTime\?[^\n]*$/m);
  });

  it("Payment.status remains typed PaymentStatus", () => {
    expect(payment).toMatch(/^\s*status\s+PaymentStatus[^\n]*$/m);
  });
});
