import { InvalidYearError } from "../errors/annual-close-errors";

/**
 * Year value-object — wraps a 4-digit fiscal year integer.
 *
 * Range invariant: `[1900, 2100]` per spec REQ-2.1. Pure TS, no decimal.js
 * dependency (just int math) — hexagonal layer 1, no infra imports.
 *
 * Out-of-range or non-integer inputs throw `InvalidYearError` (HTTP 422
 * per spec REQ-2.3). `.next()` advances by 1 and re-validates, so a Year
 * one step past the upper bound throws too.
 */

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;

export class Year {
  private constructor(public readonly value: number) {}

  static of(value: number): Year {
    if (!Number.isInteger(value) || value < MIN_YEAR || value > MAX_YEAR) {
      throw new InvalidYearError(value);
    }
    return new Year(value);
  }

  next(): Year {
    return Year.of(this.value + 1);
  }

  equals(other: Year): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
