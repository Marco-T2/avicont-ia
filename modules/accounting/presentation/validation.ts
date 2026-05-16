import { z } from "zod";
import {
  AccountType,
  AccountSubtype,
  JournalEntryStatus,
} from "@/generated/prisma/client";

export const createAccountSchema = z
  .object({
    code: z.string().min(1, "El código no puede estar vacío").optional(),
    name: z
      .string()
      .min(1, "El nombre es requerido")
      .max(200, "El nombre no puede superar los 200 caracteres"),
    type: z.nativeEnum(AccountType, { message: "Tipo de cuenta inválido" }).optional(),
    subtype: z.nativeEnum(AccountSubtype, { message: "Subtipo de cuenta inválido" }).optional(),
    parentId: z.string().min(1, "ID de cuenta padre inválido").optional(),
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

// ── Journal / ledger schemas (merged from legacy accounting.validation.ts — C4) ──
// OLEADA 6 sub-POC 7/8 poc-accounting-journal-ledger-core-hex C4: the 8
// journal/ledger zod schemas fold into this hex presentation home, merging with
// the account schemas above. No naming collision — account vs journal/ledger
// schema sets are disjoint. Content is byte-identical to the legacy source.

const journalLineSchema = z
  .object({
    accountId: z.string().min(1, "ID de cuenta inválido"),
    debit: z.number().min(0, "El débito no puede ser negativo"),
    credit: z.number().min(0, "El crédito no puede ser negativo"),
    description: z.string().optional(),
    contactId: z.string().min(1, "ID de contacto inválido").optional(),
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
  description: z
    .string()
    .max(500, "La glosa no puede superar los 500 caracteres")
    .default(""),
  periodId: z.string().min(1, "ID de periodo inválido"),
  voucherTypeId: z.string().min(1, "ID de tipo de comprobante inválido"),
  contactId: z.string().min(1, "ID de contacto inválido").optional(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  referenceNumber: z
    .number()
    .int("El número de referencia debe ser entero")
    .min(1, "El número de referencia debe ser mayor a 0")
    .optional(),
  lines: z
    .array(journalLineSchema)
    .min(2, "Se requieren al menos 2 líneas de asiento"),
});

export const updateJournalEntrySchema = z.object({
  date: z.coerce.date({ message: "Fecha inválida" }).optional(),
  description: z
    .string()
    .max(500, "La glosa no puede superar los 500 caracteres")
    .optional(),
  contactId: z.string().min(1, "ID de contacto inválido").nullable().optional(),
  referenceNumber: z
    .number()
    .int("El número de referencia debe ser entero")
    .min(1, "El número de referencia debe ser mayor a 0")
    .nullable()
    .optional(),
  // El voucher type puede cambiarse en update — el service reasigna el
  // correlativo (number) según la nueva secuencia (org, voucherType, periodId).
  // El viejo número queda como gap en la secuencia anterior.
  voucherTypeId: z
    .string()
    .min(1, "ID de tipo de comprobante inválido")
    .optional(),
  lines: z
    .array(journalLineSchema)
    .min(2, "Se requieren al menos 2 líneas de asiento")
    .optional(),
});

export const statusTransitionSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"], { message: "Transición de estado inválida" }),
  justification: z.string().optional(),
});

export const journalFiltersSchema = z.object({
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  dateTo: z.coerce.date({ message: "Fecha hasta inválida" }).optional(),
  periodId: z.string().min(1, "ID de periodo inválido").optional(),
  voucherTypeId: z.string().min(1, "ID de tipo de comprobante inválido").optional(),
  status: z.nativeEnum(JournalEntryStatus, { message: "Estado inválido" }).optional(),
});

/**
 * end-of-UTC-day for the given Date — sets the time component to
 * 23:59:59.999 in UTC, preserving the calendar day. Used to post-process
 * `dateTo` so a same-day filter window includes BOTH legacy T00 rows
 * and new T12 rows per §13.accounting.calendar-day-T12-utc-unified.
 */
function endOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

export const dateRangeSchema = z.object({
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  // §13.accounting.calendar-day-T12-utc-unified — dateTo post-processes
  // to end-of-UTC-day so the window {gte: T00, lte: T23:59:59.999} includes
  // legacy T00 rows AND new T12 rows on the same calendar day.
  dateTo: z.coerce
    .date({ message: "Fecha hasta inválida" })
    .transform((d) => endOfUtcDay(d))
    .optional(),
});

export const lastReferenceQuerySchema = z.object({
  voucherTypeId: z.string().min(1, "ID de tipo de comprobante inválido"),
  periodId: z.string().min(1, "ID de periodo inválido").optional(),
});

export const correlationAuditQuerySchema = z.object({
  voucherTypeId: z.string().min(1, "ID de tipo de comprobante inválido"),
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  dateTo: z.coerce.date({ message: "Fecha hasta inválida" }).optional(),
});

export const exportVoucherQuerySchema = z.object({
  format: z.enum(["json", "pdf"]).optional().default("json"),
  exchangeRate: z.coerce
    .number({ message: "Tipo de cambio inválido" })
    .min(0, "Tipo de cambio no puede ser negativo")
    .optional(),
  ufvRate: z.string().optional(),
});
