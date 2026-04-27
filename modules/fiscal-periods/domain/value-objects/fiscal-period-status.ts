import { InvalidFiscalPeriodStatus } from "../errors/fiscal-period-errors";

export type FiscalPeriodStatusValue = "OPEN" | "CLOSED";

const VALID: readonly FiscalPeriodStatusValue[] = ["OPEN", "CLOSED"] as const;

export class FiscalPeriodStatus {
  private constructor(public readonly value: FiscalPeriodStatusValue) {}

  static of(value: string): FiscalPeriodStatus {
    if (!VALID.includes(value as FiscalPeriodStatusValue)) {
      throw new InvalidFiscalPeriodStatus(value);
    }
    return new FiscalPeriodStatus(value as FiscalPeriodStatusValue);
  }

  static open(): FiscalPeriodStatus {
    return new FiscalPeriodStatus("OPEN");
  }

  isOpen(): boolean {
    return this.value === "OPEN";
  }

  isClosed(): boolean {
    return this.value === "CLOSED";
  }

  equals(other: FiscalPeriodStatus): boolean {
    return this.value === other.value;
  }
}
