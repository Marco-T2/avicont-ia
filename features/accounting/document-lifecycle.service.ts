import "server-only";
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
  ENTRY_POSTED_LINES_IMMUTABLE,
  ENTRY_LOCKED_IMMUTABLE,
  LOCKED_EDIT_REQUIRES_JUSTIFICATION,
  FISCAL_PERIOD_CLOSED,
  PERIOD_NOT_FOUND,
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

// ── Validar que un documento bloqueado puede ser editado (requiere admin + justificación con longitud según período) ──
//
// El mínimo de justificación es diferenciado por el estado del período:
//   - OPEN   → 10 caracteres
//   - CLOSED → 50 caracteres
//   - undefined → fail-safe: no se pudo determinar el período, se bloquea la edición
//
// Spec: REQ-A6 (audit-log/spec.md).

export function validateLockedEdit(
  status: string,
  role: string,
  periodStatus: "OPEN" | "CLOSED" | undefined,
  justification?: string,
): void {
  if (status !== "LOCKED") return; // pasar sin modificar para documentos no bloqueados

  if (role !== "owner" && role !== "admin") {
    throw new ForbiddenError("Solo administradores pueden modificar documentos bloqueados");
  }

  if (periodStatus === undefined) {
    // fail-safe: no se pudo determinar el estado del período fiscal → bloquear la edición
    throw new NotFoundError(
      "Período fiscal",
      PERIOD_NOT_FOUND,
    );
  }

  const requiredMin = periodStatus === "CLOSED" ? 50 : 10;

  if (!justification || justification.trim().length < requiredMin) {
    const periodLabel = periodStatus === "CLOSED" ? "cerrado" : "abierto";
    throw new ValidationError(
      `Se requiere una justificación de al menos ${requiredMin} caracteres para modificar un documento bloqueado en un período ${periodLabel}`,
      LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      { requiredMin },
    );
  }
}

// ── Tipo compartido: item del preview de recorte de asignaciones ─────────────

export interface TrimPreviewItem {
  allocationId: string;
  paymentDate: string;   // ISO date "YYYY-MM-DD"
  originalAmount: string; // monetary as string, 2 dp
  trimmedTo: string;     // monetary as string, 2 dp
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
