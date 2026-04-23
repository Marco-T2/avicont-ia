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

