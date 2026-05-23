import { describe, it, expect } from "vitest";
import {
  FifoStrategy,
  ManualStrategy,
  type AllocationLine,
  type AllocationStrategy,
} from "../allocation-strategy";

/**
 * REQ-PAY-6 — AllocationStrategy domain (pure, MonetaryAmount math, DEC-1).
 *
 * Replaces the inline float-cents FIFO logic in payment-form.tsx:609-631
 * (Math.min over raw floats). The domain owns the distribution rule; the form
 * consumes it as a preview (Phase 7).
 *
 * Pure-function unit tests — no I/O, no mocks, no React. Money math goes through
 * MonetaryAmount inside the strategy (DEC-1); the contract surfaces plain
 * numbers at the boundary (sister: PaymentGlosaInput consumes converted
 * numbers).
 *
 * FIFO order: oldest dueDate first; tie-break by id ascending (stable).
 *
 * Cross-ref:
 *   - sdd/pagos-cobros-fifo/spec — REQ-PAY-6, Scenario N (budget 2000 over
 *     21/05[1530] + 21/06[1232] → 1530 then 470), Scenario O (manual override).
 *   - sdd/pagos-cobros-fifo/design §5 (FifoStrategy dueDate asc + id tie-break,
 *     ManualStrategy pass-through).
 */

const lineA: AllocationLine = {
  id: "A",
  dueDate: new Date(2026, 4, 21), // 21/05/2026
  saldo: 1530,
};
const lineB: AllocationLine = {
  id: "B",
  dueDate: new Date(2026, 5, 21), // 21/06/2026
  saldo: 1232,
};

describe("FifoStrategy (REQ-PAY-6)", () => {
  it("Scenario N: budget 2000 over 21/05[1530] + 21/06[1232] → 1530 then 470, restante 0", () => {
    const strategy: AllocationStrategy = new FifoStrategy();
    const result = strategy.distribute(2000, [lineA, lineB]);

    expect(result).toEqual([
      { id: "A", applied: 1530 },
      { id: "B", applied: 470 },
    ]);
  });

  it("orders by dueDate ascending regardless of input order (oldest first)", () => {
    const strategy = new FifoStrategy();
    // B (21/06) supplied BEFORE A (21/05) — FIFO must still fill A first.
    const result = strategy.distribute(2000, [lineB, lineA]);

    expect(result).toEqual([
      { id: "A", applied: 1530 },
      { id: "B", applied: 470 },
    ]);
  });

  it("budget exceeds total saldo → each line fully covered, no over-application", () => {
    const strategy = new FifoStrategy();
    const result = strategy.distribute(5000, [lineA, lineB]);

    expect(result).toEqual([
      { id: "A", applied: 1530 },
      { id: "B", applied: 1232 },
    ]);
  });

  it("budget exhausted before later lines → later lines get 0", () => {
    const strategy = new FifoStrategy();
    const result = strategy.distribute(1000, [lineA, lineB]);

    expect(result).toEqual([
      { id: "A", applied: 1000 },
      { id: "B", applied: 0 },
    ]);
  });

  it("tie-break by id ascending when dueDates are equal (stable)", () => {
    const sameDue = new Date(2026, 4, 21);
    const z: AllocationLine = { id: "z", dueDate: sameDue, saldo: 600 };
    const a: AllocationLine = { id: "a", dueDate: sameDue, saldo: 600 };
    const strategy = new FifoStrategy();
    const result = strategy.distribute(700, [z, a]);

    // "a" < "z" → "a" filled first (600), "z" gets the remaining 100.
    expect(result).toEqual([
      { id: "a", applied: 600 },
      { id: "z", applied: 100 },
    ]);
  });

  it("uses precise decimal math — fractional cents do not drift", () => {
    const c1: AllocationLine = { id: "c1", dueDate: new Date(2026, 0, 1), saldo: 0.1 };
    const c2: AllocationLine = { id: "c2", dueDate: new Date(2026, 0, 2), saldo: 0.2 };
    const strategy = new FifoStrategy();
    const result = strategy.distribute(0.3, [c1, c2]);

    // 0.1 + 0.2 must equal exactly 0.3 with no float drift (0.30000000000000004).
    expect(result).toEqual([
      { id: "c1", applied: 0.1 },
      { id: "c2", applied: 0.2 },
    ]);
  });
});

describe("ManualStrategy (REQ-PAY-6, Scenario O)", () => {
  it("pass-through: returns each line's pre-set applied amount unchanged", () => {
    const strategy: AllocationStrategy = new ManualStrategy();
    // Manual override after FIFO: B set to 300 by the user.
    const result = strategy.distribute(2000, [
      { ...lineA, applied: 1530 },
      { ...lineB, applied: 300 },
    ]);

    expect(result).toEqual([
      { id: "A", applied: 1530 },
      { id: "B", applied: 300 },
    ]);
  });

  it("manual amounts are not re-derived from the budget", () => {
    const strategy = new ManualStrategy();
    // Budget is 0 but the user typed explicit applied amounts — preserved.
    const result = strategy.distribute(0, [
      { ...lineA, applied: 500 },
      { ...lineB, applied: 0 },
    ]);

    expect(result).toEqual([
      { id: "A", applied: 500 },
      { id: "B", applied: 0 },
    ]);
  });
});
