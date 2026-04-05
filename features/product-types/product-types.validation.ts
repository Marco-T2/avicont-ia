import { z } from "zod";

export const createProductTypeSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(20),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateProductTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(20).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export type CreateProductTypeDto = z.infer<typeof createProductTypeSchema>;
export type UpdateProductTypeDto = z.infer<typeof updateProductTypeSchema>;
