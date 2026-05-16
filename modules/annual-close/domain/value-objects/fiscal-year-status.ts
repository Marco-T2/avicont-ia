import { InvalidFiscalYearStatus } from "../errors/annual-close-errors";

/**
 * FiscalYearStatus value-object — mirrors `FiscalPeriodStatus` EXACT
 * (design rev 2 §3). Literal `OPEN | CLOSED`, `.open()` / `.closed()`
 * factories, `.of()` parser, `.isOpen()` / `.isClosed()` predicates,
 * `.equals()`.
 *
 * Hexagonal layer 1 — pure TS, no infra imports.
 */

export type FiscalYearStatusValue = "OPEN" | "CLOSED";

const VALID: readonly FiscalYearStatusValue[] = ["OPEN", "CLOSED"] as const;

export class FiscalYearStatus {
  private constructor(public readonly value: FiscalYearStatusValue) {}

  static of(value: string): FiscalYearStatus {
    if (!VALID.includes(value as FiscalYearStatusValue)) {
      throw new InvalidFiscalYearStatus(value);
    }
    return new FiscalYearStatus(value as FiscalYearStatusValue);
  }

  static open(): FiscalYearStatus {
    return new FiscalYearStatus("OPEN");
  }

  static closed(): FiscalYearStatus {
    return new FiscalYearStatus("CLOSED");
  }

  isOpen(): boolean {
    return this.value === "OPEN";
  }

  isClosed(): boolean {
    return this.value === "CLOSED";
  }

  equals(other: FiscalYearStatus): boolean {
    return this.value === other.value;
  }
}
