import { z } from "zod";

/**
 * Zod schema for the worksheet API route query params.
 *
 * Rules (REQ-10):
 * - Either `fiscalPeriodId` OR `dateFrom` + `dateTo` must be provided.
 * - If both are provided, the service uses intersection.
 * - `format` defaults to "json".
 */
export const worksheetQuerySchema = z
  .object({
    dateFrom: z
      .string()
      .date("La fecha de inicio debe tener formato YYYY-MM-DD")
      .optional(),
    dateTo: z
      .string()
      .date("La fecha de fin debe tener formato YYYY-MM-DD")
      .optional(),
    fiscalPeriodId: z.string().optional(),
    format: z.enum(["json", "pdf", "xlsx"]).optional().default("json"),
  })
  .refine(
    (data) => {
      // At least one of fiscalPeriodId OR (dateFrom + dateTo) must be provided
      if (!data.fiscalPeriodId && (!data.dateFrom || !data.dateTo)) {
        return false;
      }
      return true;
    },
    {
      message:
        "Se requiere fiscalPeriodId, o ambos campos dateFrom y dateTo para la Hoja de Trabajo",
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
  );

export type WorksheetQueryDto = z.infer<typeof worksheetQuerySchema>;
