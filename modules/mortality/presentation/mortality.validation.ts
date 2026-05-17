import { z } from "zod";

export const logMortalitySchema = z.object({
  count: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1"),
  cause: z.string().optional(),
  date: z.coerce.date({ message: "La fecha es requerida" }),
  lotId: z.string().min(1, "ID de lote inválido"),
});

/**
 * Editable fields for an existing MortalityLog. All optional, at
 * least one required. `lotId` / `organizationId` / `createdById`
 * immutable (INV-02). `cause: null` clears the field; undefined
 * keeps the prior value.
 */
export const updateMortalitySchema = z
  .object({
    count: z
      .number()
      .int("La cantidad debe ser un número entero")
      .min(1, "La cantidad mínima es 1")
      .optional(),
    cause: z.string().nullable().optional(),
    date: z.coerce.date({ message: "La fecha es requerida" }).optional(),
  })
  .refine(
    (d) =>
      d.count !== undefined ||
      d.cause !== undefined ||
      d.date !== undefined,
    { message: "Debe enviar al menos un campo a actualizar" },
  );

export const mortalityLogIdSchema = z
  .string()
  .min(1, "ID de log de mortalidad inválido");
