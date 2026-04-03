import { z } from "zod";
import { AccountType, VoucherType } from "@/generated/prisma/client";

export const accountIdSchema = z.string().cuid("ID de cuenta inválido");

export const createAccountSchema = z.object({
  code: z.string().min(1, "El código es requerido"),
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(200, "El nombre no puede superar los 200 caracteres"),
  type: z.nativeEnum(AccountType, { message: "Tipo de cuenta inválido" }),
  parentId: z.string().cuid("ID de cuenta padre inválido").optional(),
  level: z
    .number()
    .int("El nivel debe ser un número entero")
    .min(1, "El nivel mínimo es 1")
    .max(5, "El nivel máximo es 5"),
});

export const updateAccountSchema = z.object({
  name: z
    .string()
    .min(1, "El nombre es requerido")
    .max(200, "El nombre no puede superar los 200 caracteres")
    .optional(),
  isActive: z.boolean({ message: "El estado debe ser verdadero o falso" }).optional(),
});

export const journalLineSchema = z
  .object({
    accountId: z.string().cuid("ID de cuenta inválido"),
    debit: z.number().min(0, "El débito no puede ser negativo"),
    credit: z.number().min(0, "El crédito no puede ser negativo"),
  })
  .refine((line) => line.debit > 0 || line.credit > 0, {
    message: "Al menos el débito o el crédito debe ser mayor a 0",
  });

export const createJournalEntrySchema = z.object({
  date: z.coerce.date({ message: "Fecha inválida" }),
  description: z.string().min(1, "La descripción es requerida"),
  voucherType: z.nativeEnum(VoucherType, {
    message: "Tipo de comprobante inválido",
  }),
  lines: z
    .array(journalLineSchema)
    .min(2, "Se requieren al menos 2 líneas de asiento"),
});

export const journalFiltersSchema = z.object({
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  dateTo: z.coerce.date({ message: "Fecha hasta inválida" }).optional(),
  voucherType: z
    .nativeEnum(VoucherType, { message: "Tipo de comprobante inválido" })
    .optional(),
});

export const dateRangeSchema = z.object({
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  dateTo: z.coerce.date({ message: "Fecha hasta inválida" }).optional(),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
export type UpdateAccountDto = z.infer<typeof updateAccountSchema>;
export type JournalLineDto = z.infer<typeof journalLineSchema>;
export type CreateJournalEntryDto = z.infer<typeof createJournalEntrySchema>;
export type JournalFiltersDto = z.infer<typeof journalFiltersSchema>;
export type DateRangeDto = z.infer<typeof dateRangeSchema>;
