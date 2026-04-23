import { z } from "zod";

export const createLotSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  barnNumber: z
    .number()
    .int("El n\u00FAmero de galp\u00F3n debe ser entero")
    .min(1, "El n\u00FAmero de galp\u00F3n debe ser al menos 1")
    .max(10, "El n\u00FAmero de galp\u00F3n no puede superar 10"),
  initialCount: z
    .number()
    .int("La cantidad inicial debe ser un n\u00FAmero entero")
    .min(1, "La cantidad inicial debe ser al menos 1"),
  startDate: z.coerce.date({ message: "La fecha de inicio es requerida" }),
  farmId: z.string().cuid("ID de granja inv\u00E1lido"),
});

export const closeLotSchema = z.object({
  endDate: z.coerce.date({ message: "La fecha de cierre es requerida" }),
});

export type CreateLotDto = z.infer<typeof createLotSchema>;
export type CloseLotDto = z.infer<typeof closeLotSchema>;
