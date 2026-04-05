import { z } from "zod";

export const updateVoucherTypeSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede superar los 100 caracteres")
    .optional(),
  description: z
    .string()
    .max(500, "La descripción no puede superar los 500 caracteres")
    .optional(),
  isActive: z.boolean({ message: "El estado debe ser verdadero o falso" }).optional(),
});

export type UpdateVoucherTypeDto = z.infer<typeof updateVoucherTypeSchema>;
