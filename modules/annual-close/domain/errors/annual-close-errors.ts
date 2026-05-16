import { ValidationError } from "@/modules/shared/domain/errors";

/**
 * Annual-close typed errors — single bundle file convention.
 *
 * Source of truth: spec REQ-2.3 canonical error contract (11 classes).
 * Design rev 2 §3 references this list verbatim; HTTP map mirrored in
 * §7 (W-8 single source of truth). Any addition here MUST start with a
 * spec amendment per [[invariant_collision_elevation]].
 *
 * Wrap shared base errors (`@/modules/shared/domain/errors`) following the
 * cross-module precedent — mirror `monthly-close-errors.ts` shape EXACT
 * (single bundle, no \`index.ts\` barrel, no per-class separate files).
 *
 * Phase 2.2 scaffolding: only `InvalidYearError` ships here for now to
 * make Year VO tests resolvable. Phase 2.5+2.6 RED→GREEN populates the
 * remaining 10 classes per spec REQ-2.3.
 */

export const INVALID_YEAR = "INVALID_YEAR";
export const INVALID_FISCAL_YEAR_STATUS = "INVALID_FISCAL_YEAR_STATUS";

/**
 * Thrown by `Year.of(value)` when `value` is outside `[1900, 2100]` or
 * not a finite integer. HTTP 422 per spec REQ-2.3 + design §7 mapping.
 */
export class InvalidYearError extends ValidationError {
  constructor(value: number) {
    super(
      `El año debe estar entre 1900 y 2100 (recibido: ${String(value)})`,
      INVALID_YEAR,
      { value },
    );
    this.name = "InvalidYearError";
  }
}

/**
 * Thrown by `FiscalYearStatus.of(value)` when `value` is not `OPEN | CLOSED`.
 * Not part of the canonical REQ-2.3 list (it's a VO-internal guard, mirror
 * of `InvalidFiscalPeriodStatus`); HTTP 422 via the ValidationError base.
 */
export class InvalidFiscalYearStatus extends ValidationError {
  constructor(value: string) {
    super(
      `Estado de gestión inválido: ${value}`,
      INVALID_FISCAL_YEAR_STATUS,
      { value },
    );
    this.name = "InvalidFiscalYearStatus";
  }
}
