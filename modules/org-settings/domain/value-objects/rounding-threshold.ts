import { InvalidRoundingThreshold } from "../errors/org-settings-errors";

const DEFAULT_VALUE = 0.7;

export class RoundingThreshold {
  private constructor(public readonly value: number) {}

  static of(value: number): RoundingThreshold {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new InvalidRoundingThreshold(
        "El roundingThreshold debe ser un número finito",
      );
    }
    if (value < 0 || value > 1) {
      throw new InvalidRoundingThreshold(
        "El roundingThreshold debe estar entre 0 y 1",
        value,
      );
    }
    return new RoundingThreshold(value);
  }

  static default(): RoundingThreshold {
    return new RoundingThreshold(DEFAULT_VALUE);
  }

  equals(other: RoundingThreshold): boolean {
    return this.value === other.value;
  }
}
