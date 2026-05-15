import { z } from "zod";

export const createLotSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  barnNumber: z
    .number()
    .int("El número de galpón debe ser entero")
    .min(1, "El número de galpón debe ser al menos 1")
    .max(10, "El número de galpón no puede superar 10"),
  initialCount: z
    .number()
    .int("La cantidad inicial debe ser un número entero")
    .min(1, "La cantidad inicial debe ser al menos 1"),
  startDate: z.coerce.date({ message: "La fecha de inicio es requerida" }),
  farmId: z.string().min(1, "ID de granja inválido"),
});

export const closeLotSchema = z.object({
  endDate: z.coerce.date({ message: "La fecha de cierre es requerida" }),
});
