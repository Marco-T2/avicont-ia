// Isomorphic — no "server-only" import. Safe for both client and server consumers.
// Indexed 0-11 (Enero=0) to align with Date.getMonth() / Date.getUTCMonth().
// The 1-indexed month value (1..12) used in fiscal period records maps as:
//   MONTH_NAMES_ES[month - 1]
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

