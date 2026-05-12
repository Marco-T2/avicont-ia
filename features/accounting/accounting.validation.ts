import { z } from "zod";
import { JournalEntryStatus } from "@/generated/prisma/client";

// SHIM: schemas migrated to hex (POC #3d). Re-export for backward compatibility.
// Removal scheduled for POC #3e (final legacy cleanup).
export {
  createAccountSchema,
  updateAccountSchema,
} from "@/modules/accounting/presentation/validation";

const journalLineSchema = z
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
  description: z.string().min(1, "La descripción es requerida").optional(),
  contactId: z.string().cuid("ID de contacto inválido").nullable().optional(),
  referenceNumber: z
    .number()
    .int("El número de referencia debe ser entero")
    .min(1, "El número de referencia debe ser mayor a 0")
    .nullable()
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
  periodId: z.string().cuid("ID de periodo inválido").optional(),
  voucherTypeId: z.string().cuid("ID de tipo de comprobante inválido").optional(),
  status: z.nativeEnum(JournalEntryStatus, { message: "Estado inválido" }).optional(),
});

export const dateRangeSchema = z.object({
  dateFrom: z.coerce.date({ message: "Fecha desde inválida" }).optional(),
  dateTo: z.coerce.date({ message: "Fecha hasta inválida" }).optional(),
});

export const lastReferenceQuerySchema = z.object({
  voucherTypeId: z.string().cuid("ID de tipo de comprobante inválido"),
  periodId: z.string().cuid("ID de periodo inválido").optional(),
});

export const correlationAuditQuerySchema = z.object({
  voucherTypeId: z.string().cuid("ID de tipo de comprobante inválido"),
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

