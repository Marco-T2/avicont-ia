import { z } from "zod";

export const createReceivableSchema = z.object({
  contactId: z.string().min(1, "El contacto es requerido"),
  description: z
    .string()
    .min(1, "La descripción es requerida")
    .max(255, "La descripción no puede superar los 255 caracteres"),
  amount: z
    .number({ message: "El monto debe ser un número" })
    .positive("El monto debe ser mayor a cero"),
  dueDate: z.coerce.date({ message: "Fecha de vencimiento inválida" }),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  journalEntryId: z.string().optional(),
  notes: z.string().optional(),
});

export const updateReceivableSchema = z.object({
  description: z
    .string()
    .min(1, "La descripción es requerida")
    .max(255, "La descripción no puede superar los 255 caracteres")
    .optional(),
  dueDate: z.coerce.date({ message: "Fecha de vencimiento inválida" }).optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  journalEntryId: z.string().optional(),
  notes: z.string().optional(),
});

export const receivableStatusSchema = z.object({
  status: z.enum(["PENDING", "PARTIAL", "PAID", "CANCELLED"]),
  paidAmount: z
    .number({ message: "El monto pagado debe ser un número" })
    .positive("El monto pagado debe ser mayor a cero")
    .optional(),
});

export const receivableFiltersSchema = z.object({
  contactId: z.string().optional(),
  status: z.enum(["PENDING", "PARTIAL", "PAID", "CANCELLED"]).optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
});

export type CreateReceivableDto = z.infer<typeof createReceivableSchema>;
export type UpdateReceivableDto = z.infer<typeof updateReceivableSchema>;
export type ReceivableStatusDto = z.infer<typeof receivableStatusSchema>;
export type ReceivableFiltersDto = z.infer<typeof receivableFiltersSchema>;
