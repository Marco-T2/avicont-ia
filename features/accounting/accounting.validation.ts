import { z } from "zod";
import { AccountType, JournalEntryStatus } from "@/generated/prisma/client";

export const accountIdSchema = z.string().cuid("ID de cuenta inválido");

export const createAccountSchema = z
  .object({
    code: z.string().min(1, "El código no puede estar vacío").optional(),
    name: z
      .string()
      .min(1, "El nombre es requerido")
      .max(200, "El nombre no puede superar los 200 caracteres"),
    type: z.nativeEnum(AccountType, { message: "Tipo de cuenta inválido" }).optional(),
    parentId: z.string().cuid("ID de cuenta padre inválido").optional(),
    isDetail: z.boolean({ message: "El campo detalle debe ser verdadero o falso" }).optional(),
    requiresContact: z.boolean({ message: "El campo requiere contacto debe ser verdadero o falso" }).default(false),
    description: z.string().max(500, "La descripción no puede superar los 500 caracteres").optional(),
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
});

export const journalLineSchema = z
  .object({
    accountId: z.string().cuid("ID de cuenta inválido"),
    debit: z.number().min(0, "El débito no puede ser negativo"),
    credit: z.number().min(0, "El crédito no puede ser negativo"),
    description: z.string().optional(),
    contactId: z.string().cuid("ID de contacto inválido").optional(),
    order: z.number().int("El orden debe ser un número entero").min(0),
  })
  .refine((line) => !(line.debit > 0 && line.credit > 0), {
    message: "Una línea no puede tener débito y crédito simultáneamente",
  })
  .refine((line) => line.debit > 0 || line.credit > 0, {
    message: "Al menos el débito o el crédito debe ser mayor a 0",
  });

export const createJournalEntrySchema = z.object({
  date: z.coerce.date({ message: "Fecha inválida" }),
  description: z.string().min(1, "La descripción es requerida"),
  periodId: z.string().cuid("ID de periodo inválido"),
  voucherTypeId: z.string().cuid("ID de tipo de comprobante inválido"),
  contactId: z.string().cuid("ID de contacto inválido").optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  lines: z
    .array(journalLineSchema)
    .min(2, "Se requieren al menos 2 líneas de asiento"),
});

export const updateJournalEntrySchema = z.object({
  date: z.coerce.date({ message: "Fecha inválida" }).optional(),
  description: z.string().min(1, "La descripción es requerida").optional(),
  contactId: z.string().cuid("ID de contacto inválido").nullable().optional(),
  lines: z
    .array(journalLineSchema)
    .min(2, "Se requieren al menos 2 líneas de asiento")
    .optional(),
});

export const statusTransitionSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"], { message: "Transición de estado inválida" }),
});

export const journalFiltersSchema = z.object({
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  dateTo: z.coerce.date({ message: "Fecha hasta inválida" }).optional(),
  periodId: z.string().cuid("ID de periodo inválido").optional(),
  voucherTypeId: z.string().cuid("ID de tipo de comprobante inválido").optional(),
  status: z.nativeEnum(JournalEntryStatus, { message: "Estado inválido" }).optional(),
});

export const dateRangeSchema = z.object({
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  dateTo: z.coerce.date({ message: "Fecha hasta inválida" }).optional(),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
export type JournalLineDto = z.infer<typeof journalLineSchema>;
export type CreateJournalEntryDto = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryDto = z.infer<typeof updateJournalEntrySchema>;
export type StatusTransitionDto = z.infer<typeof statusTransitionSchema>;
export type JournalFiltersDto = z.infer<typeof journalFiltersSchema>;
export type DateRangeDto = z.infer<typeof dateRangeSchema>;
