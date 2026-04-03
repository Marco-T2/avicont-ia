import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const cuidParam = z.string().cuid("ID inválido");

export const orgSlugParam = z.string().min(1, "Slug de organización requerido");
