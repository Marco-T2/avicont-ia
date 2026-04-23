import { z } from "zod";

export const createFarmSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200, "El nombre no puede superar los 200 caracteres"),
  location: z.string().optional(),
  memberId: z.string().cuid("ID de miembro inválido"),
});

export const updateFarmSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200, "El nombre no puede superar los 200 caracteres").optional(),
  location: z.string().optional(),
});

export type CreateFarmDto = z.infer<typeof createFarmSchema>;
export type UpdateFarmDto = z.infer<typeof updateFarmSchema>;
