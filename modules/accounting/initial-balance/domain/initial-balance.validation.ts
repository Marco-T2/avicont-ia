import { z } from "zod";

export const initialBalanceQuerySchema = z.object({
  format: z.enum(["json", "pdf", "xlsx"]).optional().default("json"),
});

