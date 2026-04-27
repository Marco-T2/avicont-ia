export const MONTH_NAMES_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function monthNameEs(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Month out of range (1..12): ${month}`);
  }
  return MONTH_NAMES_ES[month - 1];
}
