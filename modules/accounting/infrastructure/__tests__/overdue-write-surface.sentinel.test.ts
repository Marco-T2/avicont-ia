/**
 * α-sentinel: OVERDUE write-surface closure (DEC-A, settlement-invariant-hardening).
 *
 * Cements Marco's DEC-A: OVERDUE is UNREACHABLE as a persisted aux status —
 * every write surface rejects it:
 *  - zod write schemas (`receivableStatusSchema` / `payableStatusSchema`)
 *    refuse status "OVERDUE" (POST /status → 400, was 200);
 *  - domain ALLOWED tables refuse OVERDUE as a transition TARGET from
 *    PENDING and PARTIAL (both sisters);
 *  - OVERDUE offers no exits (`OVERDUE: []`, mirrors the CANCELLED
 *    precedent) — an unreachable state has no transitions;
 *  - GREEN-GUARD (DEC-A1): `toSettlementStatus("OVERDUE")` stays "PENDING" —
 *    the mapper is TOTAL by locked design; this branch is never removed
 *    (sister sentinel: settlement-status-enum.sentinel.test.ts).
 *
 * Overdue semantics still EXIST downstream: display derives ATRASADO
 * (dueDate < now over PENDING/PARTIAL) in the contact-ledger UI and the
 * PDF/XLSX exporters — derived at read, never persisted.
 *
 * BEHAVIORAL sentinel (design D-4): asserts the real schemas/tables reject
 * OVERDUE — no source regex scan ([[sentinel_regex_line_bound]] N/A here).
 *
 * Declared failure mode (pre-GREEN): write enums still contain "OVERDUE" and
 * ALLOWED still permits it → the safeParse success:false and the
 * canTransition-false assertions FAIL ("expected true to be false"). The
 * mapper GREEN-GUARD and the positive controls are born-green and must NEVER
 * go red; if one does, STOP and escalate (DEC-A1).
 */

import { describe, expect, it } from "vitest";
import { receivableStatusSchema } from "@/modules/receivables/presentation/validation";
import { payableStatusSchema } from "@/modules/payables/presentation/validation";
import {
  RECEIVABLE_STATUSES,
  canTransition as canTransitionReceivable,
} from "@/modules/receivables/domain/value-objects/receivable-status";
import {
  PAYABLE_STATUSES,
  canTransition as canTransitionPayable,
} from "@/modules/payables/domain/value-objects/payable-status";
import { toSettlementStatus } from "@/modules/shared/domain/value-objects/settlement-status";

describe("α-sentinel — OVERDUE write-surface closure (DEC-A)", () => {
  describe("zod write schemas reject OVERDUE", () => {
    it("receivableStatusSchema rejects status OVERDUE", () => {
      expect(receivableStatusSchema.safeParse({ status: "OVERDUE" }).success).toBe(false);
    });

    it("payableStatusSchema rejects status OVERDUE", () => {
      expect(payableStatusSchema.safeParse({ status: "OVERDUE" }).success).toBe(false);
    });

    it.each(["PENDING", "PARTIAL", "PAID", "VOIDED"] as const)(
      "positive control (born-green): write schemas still accept %s",
      (status) => {
        expect(receivableStatusSchema.safeParse({ status }).success).toBe(true);
        expect(payableStatusSchema.safeParse({ status }).success).toBe(true);
      },
    );
  });

  describe("domain ALLOWED tables reject OVERDUE as target", () => {
    it.each(["PENDING", "PARTIAL"] as const)(
      "receivables: canTransition(%s, OVERDUE) is false",
      (from) => {
        expect(canTransitionReceivable(from, "OVERDUE")).toBe(false);
      },
    );

    it.each(["PENDING", "PARTIAL"] as const)(
      "payables: canTransition(%s, OVERDUE) is false",
      (from) => {
        expect(canTransitionPayable(from, "OVERDUE")).toBe(false);
      },
    );

    it("positive control (born-green): PENDING → PAID stays allowed in both sisters", () => {
      expect(canTransitionReceivable("PENDING", "PAID")).toBe(true);
      expect(canTransitionPayable("PENDING", "PAID")).toBe(true);
    });
  });

  describe("OVERDUE has no exits (unreachable state, mirrors CANCELLED)", () => {
    it("receivables: canTransition(OVERDUE, *) is false for every status", () => {
      for (const target of RECEIVABLE_STATUSES) {
        expect(canTransitionReceivable("OVERDUE", target)).toBe(false);
      }
    });

    it("payables: canTransition(OVERDUE, *) is false for every status", () => {
      for (const target of PAYABLE_STATUSES) {
        expect(canTransitionPayable("OVERDUE", target)).toBe(false);
      }
    });
  });

  describe("GREEN-GUARD (DEC-A1) — mapper stays total, branch preserved", () => {
    it("toSettlementStatus(OVERDUE) collapses to PENDING", () => {
      expect(toSettlementStatus("OVERDUE")).toBe("PENDING");
    });
  });
});
