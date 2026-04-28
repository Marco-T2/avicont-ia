import { describe, it, expect } from "vitest";
import { AllocationTarget } from "../../value-objects/allocation-target";

describe("AllocationTarget VO", () => {
  describe("forReceivable()", () => {
    it("creates a RECEIVABLE-kind target with the given id", () => {
      const t = AllocationTarget.forReceivable("rec-1");
      expect(t.kind).toBe("RECEIVABLE");
      expect(t.id).toBe("rec-1");
      expect(t.receivableId).toBe("rec-1");
      expect(t.payableId).toBeNull();
    });
  });

  describe("forPayable()", () => {
    it("creates a PAYABLE-kind target with the given id", () => {
      const t = AllocationTarget.forPayable("pay-1");
      expect(t.kind).toBe("PAYABLE");
      expect(t.id).toBe("pay-1");
      expect(t.receivableId).toBeNull();
      expect(t.payableId).toBe("pay-1");
    });
  });

  describe("equality and direction", () => {
    it("two RECEIVABLE targets with same id are equal", () => {
      const a = AllocationTarget.forReceivable("rec-1");
      const b = AllocationTarget.forReceivable("rec-1");
      expect(a.equals(b)).toBe(true);
    });

    it("RECEIVABLE and PAYABLE with same id are not equal", () => {
      const a = AllocationTarget.forReceivable("x");
      const b = AllocationTarget.forPayable("x");
      expect(a.equals(b)).toBe(false);
    });

    it("RECEIVABLE has direction COBRO", () => {
      expect(AllocationTarget.forReceivable("r").direction).toBe("COBRO");
    });

    it("PAYABLE has direction PAGO", () => {
      expect(AllocationTarget.forPayable("p").direction).toBe("PAGO");
    });
  });
});
