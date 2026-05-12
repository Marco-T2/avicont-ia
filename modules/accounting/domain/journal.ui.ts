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
  ai: "Generado por IA",
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
 * - "ai" → distinto del resto auto-generado para que el contador identifique
 *   visualmente cuáles asientos vinieron del modal de captura asistida
 *   (útil para auditoría rápida y para detectar uso vs adopción real)
 * - otros auto-generados (sale/purchase/dispatch/payment) → blue/info tones
 */
export function sourceTypeBadgeClassName(sourceType: string | null): string {
  if (sourceType === null) {
    return "bg-muted text-muted-foreground ring-border";
  }
  if (sourceType === "ai") {
    return "bg-purple-500/10 text-purple-600 ring-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400";
  }
  return "bg-info/10 text-info ring-info/30 dark:bg-info/20";
}
