export class AppError extends Error {
  public details?: Record<string, unknown>;

  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    if (details) this.details = details;
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
  constructor(
    message: string,
    code = "VALIDATION",
    details?: Record<string, unknown>,
  ) {
    super(message, 422, code, details);
  }
}

export class ConflictError extends AppError {
  constructor(
    resource: string,
    code = "CONFLICT",
    details?: Record<string, unknown>,
  ) {
    super(`${resource} ya existe`, 409, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super("No autorizado", 401, "UNAUTHORIZED");
  }
}

// --- Códigos de Error Contable ---

// Períodos Fiscales
export const FISCAL_PERIOD_YEAR_EXISTS = "FISCAL_PERIOD_YEAR_EXISTS";
export const FISCAL_PERIOD_MONTH_EXISTS = "FISCAL_PERIOD_MONTH_EXISTS";
export const INVALID_DATE_RANGE = "INVALID_DATE_RANGE";
export const PERIOD_HAS_DRAFT_ENTRIES = "PERIOD_HAS_DRAFT_ENTRIES";
export const PERIOD_ALREADY_CLOSED = "PERIOD_ALREADY_CLOSED";
export const FISCAL_PERIOD_CLOSED = "FISCAL_PERIOD_CLOSED";
export const PERIOD_NOT_FOUND = "PERIOD_NOT_FOUND"; // 404 — NotFoundError
export const PERIOD_UNBALANCED = "PERIOD_UNBALANCED"; // 422 — ValidationError

// Tipos de Comprobante
export const VOUCHER_TYPE_NOT_IN_ORG = "VOUCHER_TYPE_NOT_IN_ORG";
export const VOUCHER_TYPE_CODE_DUPLICATE = "VOUCHER_TYPE_CODE_DUPLICATE";
export const VOUCHER_TYPE_CODE_IMMUTABLE = "VOUCHER_TYPE_CODE_IMMUTABLE";

// Cuentas
export const INVALID_ACCOUNT_NATURE = "INVALID_ACCOUNT_NATURE";
export const ACCOUNT_NOT_POSTABLE = "ACCOUNT_NOT_POSTABLE";
export const ACCOUNT_TYPE_MISMATCH = "ACCOUNT_TYPE_MISMATCH";
export const MAX_ACCOUNT_DEPTH_EXCEEDED = "MAX_ACCOUNT_DEPTH_EXCEEDED";
export const INVALID_ACCOUNT_CODE_PREFIX = "INVALID_ACCOUNT_CODE_PREFIX";
// El subtipo no es válido para el AccountType dado (ej: PASIVO + ACTIVO_CORRIENTE)
export const INVALID_ACCOUNT_SUBTYPE = "INVALID_ACCOUNT_SUBTYPE";
// El subtipo explícito de la subcuenta no coincide con el subtipo heredado del padre
export const ACCOUNT_SUBTYPE_MISMATCH = "ACCOUNT_SUBTYPE_MISMATCH";

// Asientos Contables
export const JOURNAL_NOT_BALANCED = "JOURNAL_NOT_BALANCED";
export const MINIMUM_TWO_LINES_REQUIRED = "MINIMUM_TWO_LINES_REQUIRED";
export const JOURNAL_LINE_ZERO_AMOUNT = "JOURNAL_LINE_ZERO_AMOUNT";
export const JOURNAL_LINE_BOTH_SIDES = "JOURNAL_LINE_BOTH_SIDES";
export const INVALID_STATUS_TRANSITION = "INVALID_STATUS_TRANSITION";
export const ENTRY_VOIDED_IMMUTABLE = "ENTRY_VOIDED_IMMUTABLE";
export const AUTO_ENTRY_VOID_FORBIDDEN = "AUTO_ENTRY_VOID_FORBIDDEN";
export const ENTRY_POSTED_LINES_IMMUTABLE = "ENTRY_POSTED_LINES_IMMUTABLE";
export const REFERENCE_NUMBER_DUPLICATE = "REFERENCE_NUMBER_DUPLICATE";
export const VOUCHER_NUMBER_CONTENTION = "VOUCHER_NUMBER_CONTENTION";

// Contactos
export const CONTACT_NIT_EXISTS = "CONTACT_NIT_EXISTS";
export const CONTACT_REQUIRED_FOR_ACCOUNT = "CONTACT_REQUIRED_FOR_ACCOUNT";
export const CONTACT_NOT_FOUND = "CONTACT_NOT_FOUND";

// Cuentas por Cobrar / Cuentas por Pagar
export const RECEIVABLE_AMOUNT_IMMUTABLE = "RECEIVABLE_AMOUNT_IMMUTABLE";
export const PAYABLE_AMOUNT_IMMUTABLE = "PAYABLE_AMOUNT_IMMUTABLE";
// INVALID_STATUS_TRANSITION ya existe — reutilizado para transiciones CxC/CxP

// Despacho
export const DISPATCH_NO_DETAILS = "DISPATCH_NO_DETAILS";
export const DISPATCH_BC_FIELDS_ON_ND = "DISPATCH_BC_FIELDS_ON_ND";
export const DISPATCH_INVALID_CONTACT_TYPE = "DISPATCH_INVALID_CONTACT_TYPE";
export const DISPATCH_HAS_ACTIVE_PAYMENTS = "DISPATCH_HAS_ACTIVE_PAYMENTS";

// Tipos de Producto
export const PRODUCT_TYPE_DUPLICATE_CODE = "PRODUCT_TYPE_DUPLICATE_CODE";

// Pago
export const PAYMENT_EXCEEDS_BALANCE = "PAYMENT_EXCEEDS_BALANCE";
export const PAYMENT_AMBIGUOUS_LINK = "PAYMENT_AMBIGUOUS_LINK";
export const PAYMENT_MISSING_LINK = "PAYMENT_MISSING_LINK";
export const PAYMENT_CREDIT_EXCEEDS_AVAILABLE = "PAYMENT_CREDIT_EXCEEDS_AVAILABLE";
export const PAYMENT_INSUFFICIENT_FUNDS = "PAYMENT_INSUFFICIENT_FUNDS";
export const PAYMENT_DIRECTION_REQUIRED = "PAYMENT_DIRECTION_REQUIRED";

export const DISPATCH_CONTACT_CHANGE_BLOCKED = "DISPATCH_CONTACT_CHANGE_BLOCKED";
export const ENTRY_SYSTEM_GENERATED_IMMUTABLE = "ENTRY_SYSTEM_GENERATED_IMMUTABLE";

// Asignación de Pago
export const PAYMENT_MIXED_ALLOCATION = "PAYMENT_MIXED_ALLOCATION";
export const PAYMENT_ALLOCATION_EXCEEDS_BALANCE = "PAYMENT_ALLOCATION_EXCEEDS_BALANCE";
export const PAYMENT_ALLOCATIONS_EXCEED_TOTAL = "PAYMENT_ALLOCATIONS_EXCEED_TOTAL";
export const PAYMENT_ALLOCATION_TARGET_VOIDED = "PAYMENT_ALLOCATION_TARGET_VOIDED";
export const DISPATCH_NOT_DRAFT = "DISPATCH_NOT_DRAFT";

// Tipos de Documentos Operacionales
export const OPERATIONAL_DOC_TYPE_DUPLICATE_CODE = "OPERATIONAL_DOC_TYPE_DUPLICATE_CODE";
export const OPERATIONAL_DOC_TYPE_IN_USE = "OPERATIONAL_DOC_TYPE_IN_USE";

// Compra
export const PURCHASE_NO_DETAILS = "PURCHASE_NO_DETAILS";
export const PURCHASE_INVALID_CONTACT_TYPE = "PURCHASE_INVALID_CONTACT_TYPE";
export const PURCHASE_NOT_DRAFT = "PURCHASE_NOT_DRAFT";
export const PURCHASE_CONTACT_CHANGE_BLOCKED = "PURCHASE_CONTACT_CHANGE_BLOCKED";
export const PURCHASE_EXPENSE_ACCOUNT_REQUIRED = "PURCHASE_EXPENSE_ACCOUNT_REQUIRED";

// Venta
export const SALE_NO_DETAILS = "SALE_NO_DETAILS";
export const SALE_INVALID_CONTACT_TYPE = "SALE_INVALID_CONTACT_TYPE";
export const SALE_INCOME_ACCOUNT_REQUIRED = "SALE_INCOME_ACCOUNT_REQUIRED";
export const SALE_NOT_DRAFT = "SALE_NOT_DRAFT";
export const SALE_CONTACT_CHANGE_BLOCKED = "SALE_CONTACT_CHANGE_BLOCKED";

// Cierre Mensual / Bloqueado
export const ENTRY_LOCKED_IMMUTABLE = "ENTRY_LOCKED_IMMUTABLE";
export const LOCKED_EDIT_REQUIRES_JUSTIFICATION = "LOCKED_EDIT_REQUIRES_JUSTIFICATION";

// RBAC — Membership & Authorization
export const CANNOT_CHANGE_OWN_ROLE = "CANNOT_CHANGE_OWN_ROLE";
export const POST_NOT_ALLOWED_FOR_ROLE = "POST_NOT_ALLOWED_FOR_ROLE";

// RBAC — Custom Roles (PR1.3)
// NOTE: spec uses SELF_LOCK_GUARD; design D.4 used CANNOT_SELF_LOCK. Spec name chosen.
// NOTE: spec uses ROLE_HAS_MEMBERS (CR.7); design D.10 used ROLE_IN_USE. Spec name chosen.
export const SYSTEM_ROLE_IMMUTABLE = "SYSTEM_ROLE_IMMUTABLE";
export const SELF_LOCK_GUARD = "SELF_LOCK_GUARD";
export const SLUG_TAKEN = "SLUG_TAKEN";
export const RESERVED_SLUG = "RESERVED_SLUG";
export const ROLE_HAS_MEMBERS = "ROLE_HAS_MEMBERS";
