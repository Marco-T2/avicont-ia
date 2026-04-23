import { z } from "zod";

export const equityStatementQuerySchema = z
  .object({
    dateFrom: z.string().date("dateFrom debe tener formato YYYY-MM-DD"),
    dateTo:   z.string().date("dateTo debe tener formato YYYY-MM-DD"),
    format:   z.enum(["json", "pdf", "xlsx"]).optional().default("json"),
  })
  .refine((d) => d.dateFrom <= d.dateTo, {
    message: "dateFrom debe ser anterior o igual a dateTo",
    path: ["dateFrom"],
  });

