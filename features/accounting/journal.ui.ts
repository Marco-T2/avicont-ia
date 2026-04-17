/**
 * journal.ui.ts — UI helpers for JournalEntry display.
 *
 * Exported from features/accounting, co-located with journal.service.ts
 * and journal.types.ts.
 */

const SOURCE_TYPE_LABELS: Record<string, string> = {
  sale: "Generado por Venta",
  purchase: "Generado por Compra",
  dispatch: "Generado por Despacho",
  payment: "Generado por Pago",
};

/**
 * Returns a human-readable label for the JournalEntry.sourceType.
 * - null → "Manual"
 * - known type → domain label (e.g. "Generado por Venta")
 * - unknown string → "Generado automáticamente" (safe fallback)
 */
export function sourceTypeLabel(sourceType: string | null): string {
  if (sourceType === null) return "Manual";
  return SOURCE_TYPE_LABELS[sourceType] ?? "Generado automáticamente";
}

/**
 * Returns a Tailwind CSS class string for the origin badge.
 * - null (manual) → neutral/gray
 * - auto-generated → blue/indigo tones
 */
export function sourceTypeBadgeClassName(sourceType: string | null): string {
  if (sourceType === null) {
    return "bg-gray-100 text-gray-700 ring-gray-300";
  }
  return "bg-blue-50 text-blue-700 ring-blue-300";
}
