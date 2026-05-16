import type Decimal from "decimal.js";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/modules/shared/domain/errors";

/**
 * Annual-close typed errors — single bundle file convention (mirror of
 * `monthly-close-errors.ts`). NO per-class separate files, NO `index.ts`
 * barrel — single bundle precedent EXACT.
 *
 * Spec REQ-2.3 is the source of truth for the canonical 11-error list.
 * Design rev 2 §3 references this list verbatim; HTTP map mirrored in §7
 * (W-8 single source of truth). Any addition here MUST start with a spec
 * amendment per [[invariant_collision_elevation]].
 *
 * HTTP status mapping
 * ───────────────────
 * 404 — FiscalYearNotFoundError
 * 409 — FiscalYearAlreadyClosedError, PeriodAlreadyClosedError, YearOpeningPeriodsExistError
 * 422 — FiscalYearGateNotMetError, MonthsNotAllClosedError, BalanceNotZeroError,
 *       DraftEntriesInDecemberError, JustificationTooShortError, InvalidYearError
 * 500 — MissingResultAccountError (W-7 — chart-of-accounts seed bug, NOT user input)
 *
 * Money values in error payloads use `decimal.js` Decimal (DEC-1 — domain
 * layer). Stringified into `details` for serialization via `.toString()`.
 */

// ── Semantic code constants (W-8 — canonical, mirror REQ-2.3) ──────────────
export const FISCAL_YEAR_ALREADY_CLOSED = "FISCAL_YEAR_ALREADY_CLOSED";
export const FISCAL_YEAR_GATE_NOT_MET = "FISCAL_YEAR_GATE_NOT_MET";
export const MONTHS_NOT_ALL_CLOSED = "MONTHS_NOT_ALL_CLOSED";
export const BALANCE_NOT_ZERO = "BALANCE_NOT_ZERO";
export const DRAFT_ENTRIES_IN_DECEMBER = "DRAFT_ENTRIES_IN_DECEMBER";
export const PERIOD_ALREADY_CLOSED = "PERIOD_ALREADY_CLOSED";
export const YEAR_PERIODS_ALREADY_EXIST = "YEAR_PERIODS_ALREADY_EXIST";
export const MISSING_RESULT_ACCOUNT = "MISSING_RESULT_ACCOUNT";
export const JUSTIFICATION_TOO_SHORT = "JUSTIFICATION_TOO_SHORT";
export const INVALID_YEAR = "INVALID_YEAR";
export const FISCAL_YEAR_NOT_FOUND = "FISCAL_YEAR_NOT_FOUND";
export const MISSING_ACCUMULATED_RESULTS_ACCOUNT =
  "MISSING_ACCUMULATED_RESULTS_ACCOUNT";

/**
 * Explicit HTTP status for `MissingResultAccountError` (500). The spec calls
 * out this divergence from the otherwise 422-defaulted ValidationError tree;
 * surfaced as a named constant to make the W-7 carve-out greppable.
 */
export const MISSING_RESULT_ACCOUNT_HTTP = 500;
export const MISSING_ACCUMULATED_RESULTS_ACCOUNT_HTTP = 500;

// VO-internal guard (mirror of InvalidFiscalPeriodStatus). Not part of the
// canonical REQ-2.3 list; HTTP 422 via the ValidationError base.
export const INVALID_FISCAL_YEAR_STATUS = "INVALID_FISCAL_YEAR_STATUS";

// ── Canonical 11 error classes (spec REQ-2.3) ──────────────────────────────

export class FiscalYearAlreadyClosedError extends ConflictError {
  constructor(details: { fiscalYearId: string }) {
    super("La gestión anual", FISCAL_YEAR_ALREADY_CLOSED, details);
    this.name = "FiscalYearAlreadyClosedError";
    this.message = `La gestión anual ${details.fiscalYearId} ya está cerrada`;
  }
}

export interface FiscalYearGateDetails {
  monthsClosed: number;
  decStatus: "OPEN" | "CLOSED" | "NOT_FOUND";
  ccExists: boolean;
  periodsCount: number;
  reason: string;
}

export class FiscalYearGateNotMetError extends ValidationError {
  constructor(details: FiscalYearGateDetails) {
    super(
      `No se cumple la condición para cerrar la gestión: ${details.reason}`,
      FISCAL_YEAR_GATE_NOT_MET,
      details as unknown as Record<string, unknown>,
    );
    this.name = "FiscalYearGateNotMetError";
  }
}

export class MonthsNotAllClosedError extends ValidationError {
  constructor(details: { openMonths: number[] }) {
    super(
      `Faltan cerrar meses del año: ${details.openMonths.join(", ") || "(ninguno informado)"}`,
      MONTHS_NOT_ALL_CLOSED,
      details as unknown as Record<string, unknown>,
    );
    this.name = "MonthsNotAllClosedError";
  }
}

export class BalanceNotZeroError extends ValidationError {
  constructor(
    public readonly debit: Decimal,
    public readonly credit: Decimal,
  ) {
    const diff = debit.minus(credit).abs();
    super(
      `La gestión no balancea: DEBE = ${debit.toString()} / HABER = ${credit.toString()} (diferencia ${diff.toString()})`,
      BALANCE_NOT_ZERO,
      {
        debit: debit.toString(),
        credit: credit.toString(),
        diff: diff.toString(),
      },
    );
    this.name = "BalanceNotZeroError";
  }
}

export class DraftEntriesInDecemberError extends ValidationError {
  constructor(
    public readonly counts: {
      dispatches: number;
      payments: number;
      journalEntries: number;
      sales: number;
      purchases: number;
    },
  ) {
    const parts: string[] = [];
    if (counts.dispatches > 0) parts.push(`${counts.dispatches} despacho(s)`);
    if (counts.payments > 0) parts.push(`${counts.payments} pago(s)`);
    if (counts.journalEntries > 0)
      parts.push(`${counts.journalEntries} asiento(s) de diario`);
    if (counts.sales > 0) parts.push(`${counts.sales} venta(s)`);
    if (counts.purchases > 0) parts.push(`${counts.purchases} compra(s)`);
    super(
      `Diciembre tiene registros en borrador: ${parts.join(", ") || "(ninguno)"}. Publicalos o eliminalos antes de cerrar la gestión.`,
      DRAFT_ENTRIES_IN_DECEMBER,
      counts as unknown as Record<string, unknown>,
    );
    this.name = "DraftEntriesInDecemberError";
  }

  get dispatches(): number {
    return this.counts.dispatches;
  }
  get payments(): number {
    return this.counts.payments;
  }
  get journalEntries(): number {
    return this.counts.journalEntries;
  }
  get sales(): number {
    return this.counts.sales;
  }
  get purchases(): number {
    return this.counts.purchases;
  }
}

export class PeriodAlreadyClosedError extends ConflictError {
  constructor(details: { periodId: string; status: "OPEN" | "CLOSED" }) {
    super("El período fiscal", PERIOD_ALREADY_CLOSED, details);
    this.name = "PeriodAlreadyClosedError";
    this.message = `El período ${details.periodId} ya está cerrado (status=${details.status})`;
  }
}

export class YearOpeningPeriodsExistError extends ConflictError {
  constructor(details: { year: number; existingCount: number }) {
    super("Los períodos del año siguiente", YEAR_PERIODS_ALREADY_EXIST, details);
    this.name = "YearOpeningPeriodsExistError";
    this.message = `Ya existen ${details.existingCount} períodos para el año ${details.year}; abortando para evitar inicialización parcial.`;
  }
}

/**
 * MissingResultAccountError — HTTP 500 (W-7). The absence of the result
 * account `3.2.2 Resultado de la Gestión` is a chart-of-accounts seed bug,
 * NOT user input. Extends `AppError` directly to escape the 422 default of
 * ValidationError.
 */
export class MissingResultAccountError extends AppError {
  constructor(details: { organizationId: string }) {
    super(
      `Falta la cuenta de resultados (3.2.2 Resultado de la Gestión) para la organización ${details.organizationId}. Contactá al soporte: es un error de configuración del plan de cuentas.`,
      MISSING_RESULT_ACCOUNT_HTTP,
      MISSING_RESULT_ACCOUNT,
      details as unknown as Record<string, unknown>,
    );
    this.name = "MissingResultAccountError";
  }
}

/**
 * MissingAccumulatedResultsAccountError — HTTP 500 (W-7). The absence of
 * `3.2.1 Resultados Acumulados` is a chart-of-accounts seed bug, NOT user
 * input. Required by asiento #3 (P&G → 3.2.1) per REQ-A.3 of
 * annual-close-canonical-flow. Symmetric with MissingResultAccountError.
 */
export class MissingAccumulatedResultsAccountError extends AppError {
  constructor(details: { organizationId: string }) {
    super(
      `Falta la cuenta de resultados acumulados (3.2.1 Resultados Acumulados) para la organización ${details.organizationId}. Contactá al soporte: es un error de configuración del plan de cuentas.`,
      MISSING_ACCUMULATED_RESULTS_ACCOUNT_HTTP,
      MISSING_ACCUMULATED_RESULTS_ACCOUNT,
      details as unknown as Record<string, unknown>,
    );
    this.name = "MissingAccumulatedResultsAccountError";
  }
}

export class JustificationTooShortError extends ValidationError {
  constructor(details: { minLength: number; actualLength: number }) {
    super(
      `La justificación debe tener al menos ${details.minLength} caracteres (recibido: ${details.actualLength}).`,
      JUSTIFICATION_TOO_SHORT,
      details as unknown as Record<string, unknown>,
    );
    this.name = "JustificationTooShortError";
  }
}

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

export class FiscalYearNotFoundError extends NotFoundError {
  public readonly details: Record<string, unknown>;
  constructor(details: { organizationId: string; year: number }) {
    super(`La gestión ${details.year}`, FISCAL_YEAR_NOT_FOUND);
    this.name = "FiscalYearNotFoundError";
    this.details = details as unknown as Record<string, unknown>;
  }
}

// ── VO-internal guards (NOT part of REQ-2.3) ───────────────────────────────

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
