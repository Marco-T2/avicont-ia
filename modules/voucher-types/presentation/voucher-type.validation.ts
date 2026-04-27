import { z } from "zod";

const codeField = z
  .string()
  .min(2, "El código debe tener entre 2 y 6 caracteres")
  .max(6, "El código debe tener entre 2 y 6 caracteres")
  .regex(/^[A-Z0-9]+$/, "El código debe ser mayúsculas A-Z/0-9");

const nameField = z
  .string()
  .min(1, "El nombre es requerido")
  .max(100, "El nombre no puede superar los 100 caracteres");

const prefixField = z
  .string()
  .length(1, "El prefijo debe tener 1 carácter")
  .regex(/^[A-Z0-9]$/, "El prefijo debe ser A-Z o 0-9 en mayúscula");

const descriptionField = z
  .string()
  .max(500, "La descripción no puede superar los 500 caracteres")
  .optional();

export const createVoucherTypeSchema = z
  .object({
    code: codeField,
    name: nameField,
    prefix: prefixField,
    description: descriptionField,
  })
  .strict();

export const updateVoucherTypeSchema = z
  .object({
    name: nameField.optional(),
    prefix: prefixField.optional(),
    description: descriptionField,
    isActive: z
      .boolean({ message: "El estado debe ser verdadero o falso" })
      .optional(),
  })
  .strict();
