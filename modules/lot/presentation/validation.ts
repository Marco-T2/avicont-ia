import { z } from "zod";

/**
 * REQ-200 / REQ-201: post-collapse Lot create payload. The legacy
 * `farmId` FK is gone — clients send `farmName` (free text label).
 * `memberId` is NOT in the schema by design (D-2 defense-in-depth):
 * the API route resolves it server-side from the Clerk session.
 */
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
  farmName: z
    .string()
    .min(1, "El nombre de la granja es requerido")
    .max(200, "El nombre de la granja no puede superar 200 caracteres"),
});

/**
 * REQ-203 / D-4: replaces the legacy `closeLotSchema`. Same shape
 * (single `endDate`) — the rename aligns with the user-language
 * verb "desactivar" established for the binary lifecycle.
 */
export const deactivateLotSchema = z.object({
  endDate: z.coerce.date({ message: "La fecha de desactivación es requerida" }),
});

/** @deprecated Use `deactivateLotSchema` post-collapse (REQ-203, D-4). */
export const closeLotSchema = deactivateLotSchema;

/**
 * Update fields for an existing Lot. `name`, `barnNumber`, and
 * `farmName` are optional, but at least one MUST be present
 * (otherwise the call is meaningless). `initialCount`, `status`,
 * `memberId`, `organizationId` are NOT editable post-creation
 * (INV-04 — farmName is mutable per the post-collapse spec).
 */
export const updateLotSchema = z
  .object({
    name: z.string().min(1, "El nombre es requerido").optional(),
    barnNumber: z
      .number()
      .int("El número de galpón debe ser entero")
      .min(1, "El número de galpón debe ser al menos 1")
      .max(10, "El número de galpón no puede superar 10")
      .optional(),
    farmName: z
      .string()
      .min(1, "El nombre de la granja es requerido")
      .max(200, "El nombre de la granja no puede superar 200 caracteres")
      .optional(),
  })
  .refine(
    (d) =>
      d.name !== undefined ||
      d.barnNumber !== undefined ||
      d.farmName !== undefined,
    {
      message: "Debe enviar al menos un campo a actualizar",
    },
  );
