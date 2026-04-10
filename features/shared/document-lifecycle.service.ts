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

// ── Validar que una transición de estado sea válida ──

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

// ── Validar que un documento puede ser editado (DRAFT o POSTED; bloquea VOIDED y LOCKED) ──

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
  // DRAFT y POSTED pasan ambos
}

// ── Validar que un documento esté en estado DRAFT (para guardas de edición/eliminación) ──

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

// ── Validar que un documento bloqueado puede ser editado (requiere admin + justificación) ──

export function validateLockedEdit(
  status: string,
  role: string,
  justification?: string,
): void {
  if (status !== "LOCKED") return; // pasar sin modificar para documentos no bloqueados

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

// ── Validar que el período fiscal dado esté ABIERTO ──

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
