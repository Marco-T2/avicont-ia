import { z } from "zod";

export const createProductTypeSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  code: z.string().min(1).max(20).trim(),
  sortOrder: z.number().int().min(0).optional(),
});

export const updateProductTypeSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  code: z.string().min(1).max(20).trim().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});
