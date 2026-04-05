export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, code = "NOT_FOUND") {
    super(`${resource} no encontrado`, 404, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "No tenés acceso a este recurso", code = "FORBIDDEN") {
    super(message, 403, code);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, code = "VALIDATION") {
    super(message, 422, code);
  }
}

export class ConflictError extends AppError {
  constructor(resource: string, code = "CONFLICT") {
    super(`${resource} ya existe`, 409, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super("No autorizado", 401, "UNAUTHORIZED");
  }
}

// --- Accounting Error Codes ---

// Fiscal Periods
export const FISCAL_PERIOD_YEAR_EXISTS = "FISCAL_PERIOD_YEAR_EXISTS";
export const ACTIVE_PERIOD_ALREADY_EXISTS = "ACTIVE_PERIOD_ALREADY_EXISTS";
export const INVALID_DATE_RANGE = "INVALID_DATE_RANGE";
export const PERIOD_HAS_DRAFT_ENTRIES = "PERIOD_HAS_DRAFT_ENTRIES";
export const PERIOD_ALREADY_CLOSED = "PERIOD_ALREADY_CLOSED";
export const FISCAL_PERIOD_CLOSED = "FISCAL_PERIOD_CLOSED";

// Voucher Types
export const VOUCHER_TYPE_CODE_EXISTS = "VOUCHER_TYPE_CODE_EXISTS";
export const VOUCHER_TYPE_NOT_IN_ORG = "VOUCHER_TYPE_NOT_IN_ORG";

// Accounts
export const INVALID_ACCOUNT_NATURE = "INVALID_ACCOUNT_NATURE";
export const ACCOUNT_NOT_POSTABLE = "ACCOUNT_NOT_POSTABLE";
export const ACCOUNT_TYPE_MISMATCH = "ACCOUNT_TYPE_MISMATCH";
export const MAX_ACCOUNT_DEPTH_EXCEEDED = "MAX_ACCOUNT_DEPTH_EXCEEDED";
export const INVALID_ACCOUNT_CODE_PREFIX = "INVALID_ACCOUNT_CODE_PREFIX";

// Journal Entries
export const JOURNAL_NOT_BALANCED = "JOURNAL_NOT_BALANCED";
export const MINIMUM_TWO_LINES_REQUIRED = "MINIMUM_TWO_LINES_REQUIRED";
export const JOURNAL_LINE_ZERO_AMOUNT = "JOURNAL_LINE_ZERO_AMOUNT";
export const JOURNAL_LINE_BOTH_SIDES = "JOURNAL_LINE_BOTH_SIDES";
export const INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION";
export const ENTRY_VOIDED_IMMUTABLE = "ENTRY_VOIDED_IMMUTABLE";
export const ENTRY_POSTED_LINES_IMMUTABLE = "ENTRY_POSTED_LINES_IMMUTABLE";
export const REFERENCE_NUMBER_DUPLICATE = "REFERENCE_NUMBER_DUPLICATE";

// Contacts
export const CONTACT_NIT_EXISTS = "CONTACT_NIT_EXISTS";
export const CONTACT_REQUIRED_FOR_ACCOUNT = "CONTACT_REQUIRED_FOR_ACCOUNT";
export const CONTACT_NOT_FOUND = "CONTACT_NOT_FOUND";

// Receivables / Payables
export const RECEIVABLE_AMOUNT_IMMUTABLE = "RECEIVABLE_AMOUNT_IMMUTABLE";
export const PAYABLE_AMOUNT_IMMUTABLE = "PAYABLE_AMOUNT_IMMUTABLE";
// INVALID_STATUS_TRANSITION already exists — reused for CxC/CxP transitions
