import { z } from "zod";

/**
 * Zod schema for the trial-balance API route query params.
 *
 * Rules (C10):
 * - dateFrom and dateTo are REQUIRED (YYYY-MM-DD).
 * - format defaults to "json".
 * - dateFrom must be ≤ dateTo.
 */
export const trialBalanceQuerySchema = z
  .object({
    dateFrom: z
      .string()
      .date("La fecha de inicio debe tener formato YYYY-MM-DD"),
    dateTo: z
      .string()
      .date("La fecha de fin debe tener formato YYYY-MM-DD"),
    format: z.enum(["json", "pdf", "xlsx"]).optional().default("json"),
  })
  .refine(
    (data) => data.dateFrom <= data.dateTo,
    {
      message: "La fecha de inicio debe ser anterior o igual a la fecha de fin",
      path: ["dateFrom"],
    },
  );
