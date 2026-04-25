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
    return "bg-muted text-muted-foreground ring-border";
  }
  return "bg-info/10 text-info ring-info/30 dark:bg-info/20";
}
