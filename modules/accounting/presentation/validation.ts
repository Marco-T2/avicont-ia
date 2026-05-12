import { z } from "zod";
import { AccountType, AccountSubtype } from "@/generated/prisma/client";

export const createAccountSchema = z
  .object({
    code: z.string().min(1, "El código no puede estar vacío").optional(),
    name: z
      .string()
      .min(1, "El nombre es requerido")
      .max(200, "El nombre no puede superar los 200 caracteres"),
    type: z.nativeEnum(AccountType, { message: "Tipo de cuenta inválido" }).optional(),
    subtype: z.nativeEnum(AccountSubtype, { message: "Subtipo de cuenta inválido" }).optional(),
    parentId: z.string().cuid("ID de cuenta padre inválido").optional(),
    isDetail: z.boolean({ message: "El campo detalle debe ser verdadero o falso" }).optional(),
    requiresContact: z.boolean({ message: "El campo requiere contacto debe ser verdadero o falso" }).default(false),
    description: z.string().max(500, "La descripción no puede superar los 500 caracteres").optional(),
    isContraAccount: z.boolean({ message: "El campo contra-cuenta debe ser verdadero o falso" }).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.parentId && !data.type) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["type"],
        message: "El tipo de cuenta es requerido para cuentas raíz",
      });
    }
  });

export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(200, "El nombre no puede superar los 200 caracteres")
    .optional(),
  isActive: z.boolean({ message: "El estado debe ser verdadero o falso" }).optional(),
  isDetail: z.boolean({ message: "El campo detalle debe ser verdadero o falso" }).optional(),
  requiresContact: z.boolean({ message: "El campo requiere contacto debe ser verdadero o falso" }).optional(),
  description: z.string().max(500, "La descripción no puede superar los 500 caracteres").optional(),
  subtype: z.nativeEnum(AccountSubtype, { message: "Subtipo de cuenta inválido" }).optional(),
  isContraAccount: z.boolean({ message: "El campo contra-cuenta debe ser verdadero o falso" }).optional(),
});

export type CreateAccountInputDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountInputDto = z.infer<typeof updateAccountSchema>;
