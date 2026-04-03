import { z } from "zod";

export const logMortalitySchema = z.object({
  count: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1"),
  cause: z.string().optional(),
  date: z.coerce.date({ message: "La fecha es requerida" }),
  lotId: z.string().cuid("ID de lote inválido"),
});

export const mortalityFiltersSchema = z.object({
  lotId: z.string().cuid("ID de lote inválido").optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type LogMortalityDto = z.infer<typeof logMortalitySchema>;
export type MortalityFiltersDto = z.infer<typeof mortalityFiltersSchema>;
