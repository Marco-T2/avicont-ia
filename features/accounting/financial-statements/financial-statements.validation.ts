import { z } from "zod";

// ── Balance General ──

/**
 * Schema de validación para los query params del endpoint de Balance General.
 *
 * Campos:
 * - date: fecha de corte (ISO 8601, requerida)
 * - periodId: ID del período fiscal (opcional, permite usar snapshot si está cerrado)
 * - format: formato de respuesta (opcional, por defecto "json"; pdf/xlsx se implementan en PR4)
 */
export const balanceSheetQuerySchema = z.object({
  date: z
    .string({ error: "La fecha de corte es requerida" })
    .date("La fecha de corte debe tener formato YYYY-MM-DD"),
  periodId: z.string().optional(),
  format: z.enum(["json", "pdf", "xlsx"]).optional().default("json"),
});

export type BalanceSheetQueryDto = z.infer<typeof balanceSheetQuerySchema>;

// ── Estado de Resultados ──

/**
 * Schema de validación para los query params del endpoint de Estado de Resultados.
 *
 * Regla: si no se provee periodId, se requieren dateFrom + dateTo (REQ-2).
 * Validación cruzada: dateFrom debe ser anterior o igual a dateTo.
 */
export const incomeStatementQuerySchema = z
  .object({
    periodId: z.string().optional(),
    dateFrom: z
      .string()
      .date("La fecha de inicio debe tener formato YYYY-MM-DD")
      .optional(),
    dateTo: z
      .string()
      .date("La fecha de fin debe tener formato YYYY-MM-DD")
      .optional(),
    format: z.enum(["json", "pdf", "xlsx"]).optional().default("json"),
  })
  .refine(
    (data) => {
      // Si no hay periodId, se requieren ambas fechas
      if (!data.periodId && (!data.dateFrom || !data.dateTo)) {
        return false;
      }
      return true;
    },
    {
      message:
        "Se requiere periodId o ambos campos dateFrom y dateTo para el Estado de Resultados",
      path: ["dateFrom"],
    },
  )
  .refine(
    (data) => {
      // Si se proveen ambas fechas, dateFrom debe ser <= dateTo
      if (data.dateFrom && data.dateTo) {
        return data.dateFrom <= data.dateTo;
      }
      return true;
    },
    {
      message: "La fecha de inicio debe ser anterior o igual a la fecha de fin",
      path: ["dateFrom"],
    },
  );

export type IncomeStatementQueryDto = z.infer<typeof incomeStatementQuerySchema>;
