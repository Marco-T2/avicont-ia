import { z } from "zod";

export const createPaymentSchema = z.object({
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEPOSITO"]),
  date: z.coerce.date(),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  periodId: z.string().min(1),
  referenceNumber: z.number().int().positive().optional(),
  receivableId: z.string().optional(),
  payableId: z.string().optional(),
  notes: z.string().optional(),
});

export const updatePaymentSchema = z.object({
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEPOSITO"]).optional(),
  date: z.coerce.date().optional(),
  amount: z.number().positive().optional(),
  description: z.string().min(1).max(500).optional(),
  referenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const paymentStatusSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"]),
});

export const paymentFiltersSchema = z.object({
  status: z.enum(["DRAFT", "POSTED", "VOIDED"]).optional(),
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEPOSITO"]).optional(),
  contactId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  periodId: z.string().optional(),
  receivableId: z.string().optional(),
  payableId: z.string().optional(),
});

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentDto = z.infer<typeof updatePaymentSchema>;
export type PaymentStatusDto = z.infer<typeof paymentStatusSchema>;
export type PaymentFiltersDto = z.infer<typeof paymentFiltersSchema>;
