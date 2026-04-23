import { z } from "zod";

export const closeRequestSchema = z.object({
  periodId: z.string().min(1),
  justification: z.string().optional(),
});

