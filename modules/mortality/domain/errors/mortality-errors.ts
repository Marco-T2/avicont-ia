import { ValidationError } from "@/features/shared/errors";

export const MORTALITY_COUNT_EXCEEDS_ALIVE = "MORTALITY_COUNT_EXCEEDS_ALIVE";
export const INVALID_MORTALITY_COUNT = "INVALID_MORTALITY_COUNT";

export class MortalityCountExceedsAlive extends ValidationError {
  constructor(aliveCount: number) {
    super(
      `La cantidad excede los pollos vivos en el lote (${aliveCount} disponibles)`,
      MORTALITY_COUNT_EXCEEDS_ALIVE,
      { aliveCount },
    );
    this.name = "MortalityCountExceedsAlive";
  }
}

export class InvalidMortalityCount extends ValidationError {
  constructor(message: string) {
    super(message, INVALID_MORTALITY_COUNT);
    this.name = "InvalidMortalityCount";
  }
}
