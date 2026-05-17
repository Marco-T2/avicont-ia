import { ValidationError } from "@/features/shared/errors";

export const MORTALITY_COUNT_EXCEEDS_ALIVE = "MORTALITY_COUNT_EXCEEDS_ALIVE";
export const INVALID_MORTALITY_COUNT = "INVALID_MORTALITY_COUNT";
export const MORTALITY_NOT_FOUND = "MORTALITY_NOT_FOUND";

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

/**
 * Thrown by MortalityService.update / .delete when the requested log
 * id does not exist (after org scoping). Typed for paridad with
 * ExpenseNotFoundError. Marco-locked tipado vs reusing NotFoundError.
 */
export class MortalityNotFound extends Error {
  readonly statusCode = 404;
  readonly code = MORTALITY_NOT_FOUND;
  constructor(id: string) {
    super(`Log de mortalidad no encontrado: ${id}`);
    this.name = "MortalityNotFound";
  }
}
