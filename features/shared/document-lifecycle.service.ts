import {
  ValidationError,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
  ENTRY_POSTED_LINES_IMMUTABLE,
  FISCAL_PERIOD_CLOSED,
} from "@/features/shared/errors";

export type DocumentStatus = "DRAFT" | "POSTED" | "VOIDED";

const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ["POSTED"],
  POSTED: ["VOIDED"],
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

// ── Validate that a document is in DRAFT status (for edit/delete guards) ──

export function validateDraftOnly(status: DocumentStatus): void {
  if (status === "VOIDED") {
    throw new ValidationError(
      "Un documento anulado no puede ser modificado",
      ENTRY_VOIDED_IMMUTABLE,
    );
  }
  if (status === "POSTED") {
    throw new ValidationError(
      "Un documento contabilizado no puede ser modificado",
      ENTRY_POSTED_LINES_IMMUTABLE,
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
