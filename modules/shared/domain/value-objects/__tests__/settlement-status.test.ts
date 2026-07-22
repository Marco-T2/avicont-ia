/**
 * toSettlementStatus — shared TOTAL mapper (unified-comprobante-source-of-truth, D3).
 *
 * Single mapping home for both repo sisters (prevents receivables/payables
 * drift); the backfill SQL CASE mirrors this table textually.
 *
 * Locked mapping: PENDING/PARTIAL/PAID/VOIDED passthrough; CANCELLED→VOIDED
 * (legacy pg-compat member, app already writes VOIDED); OVERDUE→PENDING
 * (defensive totality — OVERDUE is read-derived, never persisted).
 *
 * Declared failure mode (pre-GREEN): module
 * `modules/shared/domain/value-objects/settlement-status.ts` does not exist →
 * import unresolved, suite errors at collection.
 */

import { describe, expect, it } from "vitest";
import {
  RECEIVABLE_STATUSES,
  type ReceivableStatus,
} from "@/modules/receivables/domain/value-objects/receivable-status";
import {
  PAYABLE_STATUSES,
  type PayableStatus,
} from "@/modules/payables/domain/value-objects/payable-status";
import {
  SETTLEMENT_STATUSES,
  toSettlementStatus,
  type SettlementStatus,
} from "../settlement-status";

// Type-level totality: the mapper must accept EVERY member of both source
// unions (checked by the tsc --noEmit gate, not at runtime).
const _acceptsReceivable: (s: ReceivableStatus) => SettlementStatus =
  toSettlementStatus;
const _acceptsPayable: (s: PayableStatus) => SettlementStatus =
  toSettlementStatus;
void _acceptsReceivable;
void _acceptsPayable;

describe("toSettlementStatus — exhaustive locked mapping (D3)", () => {
  it.each([
    ["PENDING", "PENDING"],
    ["PARTIAL", "PARTIAL"],
    ["PAID", "PAID"],
    ["VOIDED", "VOIDED"],
    ["CANCELLED", "VOIDED"], // legacy member — app writes VOIDED
    ["OVERDUE", "PENDING"], // read-derived, never persisted — defensive totality
  ] as const)("maps %s → %s", (input, expected) => {
    expect(toSettlementStatus(input)).toBe(expected);
  });

  it("is total over every runtime member of RECEIVABLE_STATUSES and PAYABLE_STATUSES", () => {
    for (const status of [...RECEIVABLE_STATUSES, ...PAYABLE_STATUSES]) {
      expect(SETTLEMENT_STATUSES).toContain(toSettlementStatus(status));
    }
  });

  it("exposes SETTLEMENT_STATUSES with exactly the 4 persisted members", () => {
    expect(SETTLEMENT_STATUSES).toEqual(["PENDING", "PARTIAL", "PAID", "VOIDED"]);
  });
});
