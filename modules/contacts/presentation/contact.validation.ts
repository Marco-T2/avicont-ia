import { z } from "zod";
import { CONTACT_TYPES } from "../domain/value-objects/contact-type";

const typeField = z.enum(CONTACT_TYPES, {
  error: "Tipo de contacto inválido",
});

const nameField = z
  .string()
  .min(1, "El nombre es requerido")
  .max(200, "El nombre no puede superar los 200 caracteres");

const nitField = z
  .string()
  .max(20, "El NIT no puede superar los 20 caracteres");

const emailField = z
  .string()
  .email("El correo electrónico no es válido")
  .max(100, "El correo no puede superar los 100 caracteres");

const phoneField = z
  .string()
  .max(30, "El teléfono no puede superar los 30 caracteres");

const addressField = z
  .string()
  .max(500, "La dirección no puede superar los 500 caracteres");

const paymentTermsDaysField = z
  .number()
  .int("Los días de plazo deben ser un número entero")
  .min(0, "Los días de plazo no pueden ser negativos")
  .max(365, "Los días de plazo no pueden superar los 365 días");

const creditLimitField = z
  .number()
  .min(0, "El límite de crédito no puede ser negativo");

export const createContactSchema = z.object({
  type: typeField,
  name: nameField,
  nit: nitField.optional(),
  email: emailField.optional(),
  phone: phoneField.optional(),
  address: addressField.optional(),
  paymentTermsDays: paymentTermsDaysField.optional(),
  creditLimit: creditLimitField.nullable().optional(),
});

export const updateContactSchema = z.object({
  type: typeField.optional(),
  name: nameField.optional(),
  nit: nitField.nullable().optional(),
  email: emailField.nullable().optional(),
  phone: phoneField.nullable().optional(),
  address: addressField.nullable().optional(),
  paymentTermsDays: paymentTermsDaysField.optional(),
  creditLimit: creditLimitField.nullable().optional(),
});

export const contactFiltersSchema = z.object({
  type: typeField.optional(),
  excludeTypes: z.array(typeField).optional(),
  isActive: z.boolean().optional(),
  search: z
    .string()
    .max(100, "El término de búsqueda es demasiado largo")
    .optional(),
});
