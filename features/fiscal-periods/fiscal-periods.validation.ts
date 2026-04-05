import { z } from "zod";

export const createFiscalPeriodSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "El nombre no puede superar los 100 caracteres"),
  year: z
    .number()
    .int("El año debe ser un número entero")
    .min(2000, "El año mínimo es 2000")
    .max(2100, "El año máximo es 2100"),
  startDate: z.coerce.date({ message: "Fecha de inicio inválida" }),
  endDate: z.coerce.date({ message: "Fecha de cierre inválida" }),
});

export const closeFiscalPeriodSchema = z.object({
  status: z.literal("CLOSED"),
});

export type CreateFiscalPeriodDto = z.infer<typeof createFiscalPeriodSchema>;
export type CloseFiscalPeriodDto = z.infer<typeof closeFiscalPeriodSchema>;
