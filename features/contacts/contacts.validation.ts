import { z } from "zod";

// ── Create contact schema ──

export const createContactSchema = z.object({
  type: z.enum(["CLIENTE", "PROVEEDOR", "SOCIO", "TRANSPORTISTA", "OTRO"], {
    error: "Tipo de contacto inválido",
  }),
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(200, "El nombre no puede superar los 200 caracteres"),
  nit: z
    .string()
    .max(20, "El NIT no puede superar los 20 caracteres")
    .optional(),
  email: z
    .string()
    .email("El correo electrónico no es válido")
    .max(100, "El correo no puede superar los 100 caracteres")
    .optional(),
  phone: z
    .string()
    .max(30, "El teléfono no puede superar los 30 caracteres")
    .optional(),
  address: z
    .string()
    .max(500, "La dirección no puede superar los 500 caracteres")
    .optional(),
  paymentTermsDays: z
    .number()
    .int("Los días de plazo deben ser un número entero")
    .min(0, "Los días de plazo no pueden ser negativos")
    .max(365, "Los días de plazo no pueden superar los 365 días")
    .optional(),
  creditLimit: z
    .number()
    .min(0, "El límite de crédito no puede ser negativo")
    .nullable()
    .optional(),
});

// ── Update contact schema (all fields optional) ──

export const updateContactSchema = z.object({
  type: z
    .enum(["CLIENTE", "PROVEEDOR", "SOCIO", "TRANSPORTISTA", "OTRO"], {
      error: "Tipo de contacto inválido",
    })
    .optional(),
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(200, "El nombre no puede superar los 200 caracteres")
    .optional(),
  nit: z
    .string()
    .max(20, "El NIT no puede superar los 20 caracteres")
    .nullable()
    .optional(),
  email: z
    .string()
    .email("El correo electrónico no es válido")
    .max(100, "El correo no puede superar los 100 caracteres")
    .nullable()
    .optional(),
  phone: z
    .string()
    .max(30, "El teléfono no puede superar los 30 caracteres")
    .nullable()
    .optional(),
  address: z
    .string()
    .max(500, "La dirección no puede superar los 500 caracteres")
    .nullable()
    .optional(),
  paymentTermsDays: z
    .number()
    .int("Los días de plazo deben ser un número entero")
    .min(0, "Los días de plazo no pueden ser negativos")
    .max(365, "Los días de plazo no pueden superar los 365 días")
    .optional(),
  creditLimit: z
    .number()
    .min(0, "El límite de crédito no puede ser negativo")
    .nullable()
    .optional(),
});

// ── Filters schema ──

export const contactFiltersSchema = z.object({
  type: z
    .enum(["CLIENTE", "PROVEEDOR", "SOCIO", "TRANSPORTISTA", "OTRO"])
    .optional(),
  isActive: z.boolean().optional(),
  search: z.string().max(100, "El término de búsqueda es demasiado largo").optional(),
});

// ── Inferred DTO types ──

export type CreateContactDto = z.infer<typeof createContactSchema>;
export type UpdateContactDto = z.infer<typeof updateContactSchema>;
export type ContactFiltersDto = z.infer<typeof contactFiltersSchema>;
