import { z } from "zod";

export const initialBalanceQuerySchema = z.object({
  format: z.enum(["json", "pdf", "xlsx"]).optional().default("json"),
});

export type InitialBalanceQueryDto = z.infer<typeof initialBalanceQuerySchema>;
