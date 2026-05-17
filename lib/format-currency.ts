/**
 * Bolivian currency formatting. Sin prefijo "Bs." — el sistema es mono-moneda
 * (BOB) y el símbolo es redundante en cada celda de tabla/línea de form.
 */

export function formatBs(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(n)) return "0,00";
  return n.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Variante contable: negativos en paréntesis `(1.234,56)`. Usar en dashboards
 * CxC/CxP donde la columna mezcla saldos positivos y negativos.
 */
export function formatBsAccounting(value: number | string): string {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (n < 0) {
    return `(${formatBs(Math.abs(n))})`;
  }
  return formatBs(n);
}
