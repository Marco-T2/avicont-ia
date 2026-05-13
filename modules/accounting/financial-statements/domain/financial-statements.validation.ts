import { z } from "zod";

// ── Constantes de preset ──────────────────────────────────────────────────────

const ALL_DATE_PRESET_IDS = [
  "all_dates",
  "custom_date",
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "this_month_to_date",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_year",
  "this_year_to_date",
  "last_year",
  "last_30_days",
  "last_90_days",
  "last_12_months",
] as const;

// ── Balance General ──────────────────────────────────────────────────────────

/**
 * Schema de validación para los query params del endpoint de Balance General.
 *
 * Campos base:
 * - date: fecha de corte (ISO 8601, requerida)
 * - periodId: ID del período fiscal (opcional)
 * - format: formato de respuesta (opcional, por defecto "json")
 *
 * Campos nuevos (PR1):
 * - preset: macro de período (opcional, 17 valores)
 * - breakdownBy: granularidad de columnas (por defecto "total")
 * - compareWith: modo comparativo (por defecto "none")
 * - compareAsOfDate: requerida cuando compareWith="custom"
 */
export const balanceSheetQuerySchema = z
  .object({
    date: z
      .string({ error: "La fecha de corte es requerida" })
      .date("La fecha de corte debe tener formato YYYY-MM-DD"),
    periodId: z.string().optional(),
    format: z.enum(["json", "pdf", "xlsx"]).optional().default("json"),
    preset: z.enum(ALL_DATE_PRESET_IDS).optional(),
    breakdownBy: z
      .enum(["total", "months", "quarters", "years"])
      .optional()
      .default("total"),
    compareWith: z
      .enum(["none", "previous_period", "previous_year", "custom"])
      .optional()
      .default("none"),
    compareAsOfDate: z.string().date().optional(),
  })
  .refine(
    (data) =>
      data.compareWith !== "custom" || !!data.compareAsOfDate,
    {
      message: "compareAsOfDate required when compareWith=custom",
      path: ["compareAsOfDate"],
    },
  );

// ── Estado de Resultados ──────────────────────────────────────────────────────

/**
 * Schema de validación para los query params del endpoint de Estado de Resultados.
 *
 * Regla base: si no se provee periodId, se requieren dateFrom + dateTo (REQ-2).
 * Validación cruzada: dateFrom debe ser anterior o igual a dateTo.
 *
 * Campos nuevos (PR1):
 * - preset: macro de período
 * - breakdownBy: granularidad de columnas (por defecto "total")
 * - compareWith: modo comparativo (por defecto "none")
 * - compareDateFrom / compareDateTo: requeridos cuando compareWith="custom"
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
    preset: z.enum(ALL_DATE_PRESET_IDS).optional(),
    breakdownBy: z
      .enum(["total", "months", "quarters", "years"])
      .optional()
      .default("total"),
    compareWith: z
      .enum(["none", "previous_period", "previous_year", "custom"])
      .optional()
      .default("none"),
    compareDateFrom: z.string().date().optional(),
    compareDateTo: z.string().date().optional(),
  })
  .refine(
    (data) => {
      if (!data.periodId && !data.preset && (!data.dateFrom || !data.dateTo)) {
        return false;
      }
      return true;
    },
    {
      message:
        "Se requiere periodId, preset, o ambos campos dateFrom y dateTo para el Estado de Resultados",
      path: ["dateFrom"],
    },
  )
  .refine(
    (data) => {
      if (data.dateFrom && data.dateTo) {
        return data.dateFrom <= data.dateTo;
      }
      return true;
    },
    {
      message: "La fecha de inicio debe ser anterior o igual a la fecha de fin",
      path: ["dateFrom"],
    },
  )
  .refine(
    (data) =>
      data.compareWith !== "custom" ||
      (!!data.compareDateFrom && !!data.compareDateTo),
    {
      message:
        "compareDateFrom + compareDateTo required when compareWith=custom",
      path: ["compareDateFrom"],
    },
  );
