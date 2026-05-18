import { z } from "zod";

/**
 * Post simplify-lot-identifier Lot create payload. Marco-locked
 * simplification: the bare `name` + `barnNumber` fields are gone —
 * a lot is uniquely identified by `farmName + startDate` (DB-level
 * @@unique), and consumers render `displayName =
 * "{farmName} - DD/MM/YYYY"` derived from those two columns.
 * `memberId` is NOT in the schema by design (D-2 defense-in-depth):
 * the API route resolves it server-side from the Clerk session.
 */
export const createLotSchema = z.object({
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
 * Update payload for an existing Lot. Post simplify-lot-identifier
 * only `farmName` is mutable (`initialCount`, `startDate`, `status`,
 * `memberId`, `organizationId` are NOT editable post-creation —
 * startDate is now part of the identity tuple). The single optional
 * field is still required to be present so the request is meaningful.
 */
export const updateLotSchema = z
  .object({
    farmName: z
      .string()
      .min(1, "El nombre de la granja es requerido")
      .max(200, "El nombre de la granja no puede superar 200 caracteres")
      .optional(),
  })
  .refine((d) => d.farmName !== undefined, {
    message: "Debe enviar al menos un campo a actualizar",
  });
