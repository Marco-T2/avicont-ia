/** R5 absoluta — pure function, ZERO Prisma imports. */

import type { AuditClassification, AuditEntityType } from "./audit.types";

export type ParentContext =
  | { kind: "none" }
  | { kind: "journal_entries"; sourceType: string | null };

/**
 * Clasifica una fila de auditoría como "directa" o "indirecta" siguiendo la
 * tabla cerrada del spec REQ-AUDIT.3.
 */
export function classify(
  entityType: AuditEntityType,
  parentContext: ParentContext,
): AuditClassification {
  switch (entityType) {
    case "sales":
    case "purchases":
    case "payments":
    case "dispatches":
    case "sale_details":
    case "purchase_details":
      return "directa";

    case "journal_entries":
    case "journal_lines":
      if (parentContext.kind !== "journal_entries") {
        throw new Error(
          `classify: missing parent context for ${entityType} — repository must resolve journal_entries.sourceType via LEFT JOIN`,
        );
      }
      return parentContext.sourceType === null ? "directa" : "indirecta";

    default: {
      const _exhaustive: never = entityType;
      throw new Error(`classify: unhandled entityType ${String(_exhaustive)}`);
    }
  }
}
