import type { Prisma } from "@/generated/prisma/client";
import type { IncomeStatementCurrent } from "./types/financial-statements.types";

// Alias local para Decimal
type Decimal = Prisma.Decimal;

/**
 * Calcula la Utilidad Neta del ejercicio (o Pérdida si es negativo).
 *
 * Es la única fuente de verdad para este cálculo (REQ-3):
 * tanto el Balance General como el Estado de Resultados la invocan.
 *
 * Fórmula: income.total − expenses.total
 *
 * - Positivo → Utilidad del Ejercicio
 * - Negativo → Pérdida del Ejercicio
 * - Cero    → sin resultado (período sin movimientos)
 *
 * Función pura: no accede a Prisma, no produce efectos secundarios.
 */
export function calculateRetainedEarnings(is: IncomeStatementCurrent): Decimal {
  return is.income.total.minus(is.expenses.total);
}
