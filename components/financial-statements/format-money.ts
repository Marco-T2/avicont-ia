/**
 * Formatea un valor monetario en BOB (bolivianos) con 2 decimales.
 * Acepta string (proveniente de serializeStatement) o number.
 * Ejemplo: "1234.56" → "Bs. 1.234,56"
 */
export function formatBOB(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "Bs. 0,00";

  const formatted = new Intl.NumberFormat("es-BO", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return `Bs. ${formatted}`;
}
