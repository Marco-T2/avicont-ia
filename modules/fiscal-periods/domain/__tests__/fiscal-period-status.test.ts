import { describe, it, expect } from "vitest";
import { FiscalPeriodStatus } from "../value-objects/fiscal-period-status";
import { InvalidFiscalPeriodStatus } from "../errors/fiscal-period-errors";

describe("FiscalPeriodStatus.of", () => {
  it("accepts 'OPEN'", () => {
    const s = FiscalPeriodStatus.of("OPEN");
    expect(s.value).toBe("OPEN");
    expect(s.isOpen()).toBe(true);
    expect(s.isClosed()).toBe(false);
  });

  it("accepts 'CLOSED'", () => {
    const s = FiscalPeriodStatus.of("CLOSED");
    expect(s.value).toBe("CLOSED");
    expect(s.isOpen()).toBe(false);
    expect(s.isClosed()).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(() => FiscalPeriodStatus.of("DRAFT")).toThrow(
      InvalidFiscalPeriodStatus,
    );
    expect(() => FiscalPeriodStatus.of("")).toThrow(
      InvalidFiscalPeriodStatus,
    );
  });
});

describe("FiscalPeriodStatus.open", () => {
  it("returns an OPEN instance", () => {
    expect(FiscalPeriodStatus.open().value).toBe("OPEN");
  });
});

describe("FiscalPeriodStatus.equals", () => {
  it("returns true for same value", () => {
    expect(
      FiscalPeriodStatus.of("OPEN").equals(FiscalPeriodStatus.of("OPEN")),
    ).toBe(true);
  });

  it("returns false for different value", () => {
    expect(
      FiscalPeriodStatus.of("OPEN").equals(FiscalPeriodStatus.of("CLOSED")),
    ).toBe(false);
  });
});
