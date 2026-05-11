import { z } from "zod";
import { OPERATIONAL_DOC_DIRECTIONS } from "../domain/value-objects/operational-doc-direction";

export const createOperationalDocTypeSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(20)
    .trim()
    .transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(100).trim(),
  direction: z.enum(OPERATIONAL_DOC_DIRECTIONS, {
    message: "Dirección de documento operacional inválida",
  }),
});

export const updateOperationalDocTypeSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  direction: z
    .enum(OPERATIONAL_DOC_DIRECTIONS, {
      message: "Dirección de documento operacional inválida",
    })
    .optional(),
  isActive: z.boolean().optional(),
});
