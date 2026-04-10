import { z } from "zod";

export const agentQuerySchema = z.object({
  prompt: z.string().min(1, "Se requiere un prompt"),
  session_id: z.string().optional(),
});

export const confirmActionSchema = z.object({
  suggestion: z.object({
    action: z.string().min(1, "Se requiere una acción"),
    data: z.record(z.string(), z.unknown()).default({}),
  }),
});

export type AgentQueryDto = z.infer<typeof agentQuerySchema>;
export type ConfirmActionDto = z.infer<typeof confirmActionSchema>;
