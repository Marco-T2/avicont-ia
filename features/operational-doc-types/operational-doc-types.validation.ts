import { z } from "zod";
import { OperationalDocDirection } from "@/generated/prisma/client";

export const createOperationalDocTypeSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(20)
    .trim()
    .transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(100).trim(),
  direction: z.nativeEnum(OperationalDocDirection),
});

export const updateOperationalDocTypeSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  direction: z.nativeEnum(OperationalDocDirection).optional(),
  isActive: z.boolean().optional(),
});

export type CreateOperationalDocTypeDto = z.infer<
  typeof createOperationalDocTypeSchema
>;
export type UpdateOperationalDocTypeDto = z.infer<
  typeof updateOperationalDocTypeSchema
>;
