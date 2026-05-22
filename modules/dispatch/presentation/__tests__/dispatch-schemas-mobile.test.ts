/**
 * TDD RED → GREEN — mobile offline contract tests.
 *
 * Change A: boxes >= 0 (trozado sin cajas)
 * Change B: periodId optional in createDispatchSchema
 * Change C: clientId optional in createDispatchSchema
 */
import { describe, it, expect } from "vitest";
import { createDispatchSchema } from "../schemas/dispatch.schemas";

// ── Shared helpers ─────────────────────────────────────────────────────────

const BASE_DETAIL = {
  description: "Pollo entero",
  boxes: 5,
  grossWeight: 100,
  unitPrice: 15,
  order: 0,
};

const BASE_DISPATCH = {
  dispatchType: "NOTA_DESPACHO" as const,
  date: new Date("2026-05-19"),
  contactId: "contact-1",
  periodId: "period-1",
  description: "Despacho test",
  details: [BASE_DETAIL],
};

// ── Change A: boxes >= 0 ───────────────────────────────────────────────────

describe("dispatchDetailSchema — boxes >= 0 (change A)", () => {
  it("rejects boxes = -1", () => {
    const result = createDispatchSchema.safeParse({
      ...BASE_DISPATCH,
      details: [{ ...BASE_DETAIL, boxes: -1 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts boxes = 0 (trozado sin cajas)", () => {
    const result = createDispatchSchema.safeParse({
      ...BASE_DISPATCH,
      details: [{ ...BASE_DETAIL, boxes: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts boxes = 1 (retrocompatible)", () => {
    const result = createDispatchSchema.safeParse({
      ...BASE_DISPATCH,
      details: [{ ...BASE_DETAIL, boxes: 1 }],
    });
    expect(result.success).toBe(true);
  });
});

// ── Change B: periodId optional ────────────────────────────────────────────

describe("createDispatchSchema — periodId optional (change B)", () => {
  it("accepts payload without periodId (mobile offline)", () => {
    const { periodId: _p, ...withoutPeriodId } = BASE_DISPATCH;
    const result = createDispatchSchema.safeParse(withoutPeriodId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodId).toBeUndefined();
    }
  });

  it("accepts payload with periodId (web retrocompatible)", () => {
    const result = createDispatchSchema.safeParse(BASE_DISPATCH);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.periodId).toBe("period-1");
    }
  });
});

// ── Change C: clientId optional ────────────────────────────────────────────

describe("createDispatchSchema — clientId optional (change C)", () => {
  it("accepts payload without clientId (web, retrocompatible)", () => {
    const result = createDispatchSchema.safeParse(BASE_DISPATCH);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientId).toBeUndefined();
    }
  });

  it("accepts payload with clientId UUID (mobile)", () => {
    const result = createDispatchSchema.safeParse({
      ...BASE_DISPATCH,
      clientId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientId).toBe("550e8400-e29b-41d4-a716-446655440000");
    }
  });
});
