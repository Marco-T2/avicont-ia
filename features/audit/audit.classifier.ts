// features/audit/audit.classifier.ts
//
// NO `import "server-only"` — función pura, importable desde tests, desde el
// service, y eventualmente desde componentes cliente si se decide mostrar la
// clasificación en la UI con lógica compartida.

import type { AuditClassification, AuditEntityType } from "./audit.types";

export type ParentContext =
  | { kind: "none" }
  | { kind: "journal_entries"; sourceType: string | null };

/**
 * Clasifica una fila de auditoría como "directa" o "indirecta" siguiendo la
 * tabla cerrada del spec REQ-AUDIT.3:
 *
 * - sales / purchases / payments / dispatches → directa (cualquier caso).
 * - sale_details / purchase_details → directa (padre siempre directa).
 * - journal_entries → directa si sourceType IS NULL, indirecta si no.
 * - journal_lines → hereda del padre journal_entries (requiere parentContext).
 *
 * Para journal_entries / journal_lines el caller DEBE pasar parentContext con
 * kind "journal_entries"; pasar { kind: "none" } es un bug del repository que
 * no resolvió el LEFT JOIN a journal_entries.sourceType.
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
