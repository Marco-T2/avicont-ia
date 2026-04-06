import {
  ValidationError,
  ForbiddenError,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
  ENTRY_POSTED_LINES_IMMUTABLE,
  ENTRY_LOCKED_IMMUTABLE,
  LOCKED_EDIT_REQUIRES_JUSTIFICATION,
  FISCAL_PERIOD_CLOSED,
} from "@/features/shared/errors";

export type DocumentStatus = "DRAFT" | "POSTED" | "LOCKED" | "VOIDED";

const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ["POSTED"],
  POSTED: ["LOCKED", "VOIDED"],
  LOCKED: ["VOIDED"],
  VOIDED: [],
};

// ── Validate that a status transition is legal ──

export function validateTransition(
  current: DocumentStatus,
  target: DocumentStatus,
): void {
  if (current === "VOIDED") {
    throw new ValidationError(
      "Un documento anulado no puede ser modificado",
      ENTRY_VOIDED_IMMUTABLE,
    );
  }

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed.includes(target)) {
    throw new ValidationError(
      `Transición inválida: ${current} → ${target}`,
      INVALID_STATUS_TRANSITION,
    );
  }
}

// ── Validate that a document can be edited (DRAFT or POSTED; blocks VOIDED and LOCKED) ──

export function validateEditable(status: DocumentStatus): void {
  if (status === "VOIDED") {
    throw new ValidationError(
      "Un documento anulado no puede ser modificado",
      ENTRY_VOIDED_IMMUTABLE,
    );
  }
  if (status === "LOCKED") {
    throw new ValidationError(
      "Un documento bloqueado no puede ser modificado sin justificación",
      ENTRY_LOCKED_IMMUTABLE,
    );
  }
  // DRAFT and POSTED both pass
}

// ── Validate that a document is in DRAFT status (for edit/delete guards) ──

export function validateDraftOnly(status: DocumentStatus): void {
  if (status === "VOIDED") {
    throw new ValidationError(
      "Un documento anulado no puede ser modificado",
      ENTRY_VOIDED_IMMUTABLE,
    );
  }
  if (status === "LOCKED") {
    throw new ValidationError(
      "Un documento bloqueado no puede ser modificado sin justificación",
      ENTRY_LOCKED_IMMUTABLE,
    );
  }
  if (status === "POSTED") {
    throw new ValidationError(
      "Un documento contabilizado no puede ser modificado",
      ENTRY_POSTED_LINES_IMMUTABLE,
    );
  }
}

// ── Validate that a locked document can be edited (requires admin + justification) ──

export function validateLockedEdit(
  status: string,
  role: string,
  justification?: string,
): void {
  if (status !== "LOCKED") return; // pass through for non-locked

  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Solo administradores pueden modificar documentos bloqueados");
  }

  if (!justification || justification.trim().length < 10) {
    throw new ValidationError(
      "Se requiere una justificación de al menos 10 caracteres para modificar un documento bloqueado",
      LOCKED_EDIT_REQUIRES_JUSTIFICATION,
    );
  }
}

// ── Validate that the given fiscal period is OPEN ──

export async function validatePeriodOpen(
  period: { status: string },
): Promise<void> {
  if (period.status !== "OPEN") {
    throw new ValidationError(
      "No se puede operar en un período cerrado",
      FISCAL_PERIOD_CLOSED,
    );
  }
}
