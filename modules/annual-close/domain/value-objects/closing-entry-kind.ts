/**
 * ClosingEntryKind — 5-asientos canonical kind labels for the
 * annual-close-canonical-flow change.
 *
 * Each label corresponds to one of the 5 journal entries emitted by the
 * canonical Bolivian annual close:
 *   #1 GASTOS    — Cerrar Gastos y Costos (Dec 31, voucher code 'CC')
 *   #2 INGRESOS  — Cerrar Ingresos (Dec 31, voucher code 'CC')
 *   #3 RESULTADO — Cerrar P&G → 3.2.1 Resultados Acumulados (Dec 31, 'CC')
 *   #4 BALANCE   — Cerrar Balance / ACTIVO/PASIVO/PATRIMONIO (Dec 31, 'CC')
 *   #5 APERTURA  — Apertura de Gestión (Jan 1 year+1, voucher code 'CA')
 *
 * Pure constant union; no class. Used by audit description suffixes and
 * service step labels per design rev annual-close-canonical-flow #2696.
 *
 * Hexagonal layer 1 — pure TS, no infra imports.
 */
export const ClosingEntryKind = {
  GASTOS: "GASTOS",
  INGRESOS: "INGRESOS",
  RESULTADO: "RESULTADO",
  BALANCE: "BALANCE",
  APERTURA: "APERTURA",
} as const;

export type ClosingEntryKind =
  (typeof ClosingEntryKind)[keyof typeof ClosingEntryKind];
