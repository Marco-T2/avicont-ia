import { z } from "zod";

const creditAllocationSourceSchema = z.object({
  sourcePaymentId: z.string(),
  receivableId: z.string(),
  amount: z.number().positive(),
});

const allocationInputSchema = z.object({
  receivableId: z.string().optional(),
  payableId: z.string().optional(),
  amount: z.number().positive("El monto debe ser mayor a cero"),
}).refine(
  (data) => (data.receivableId && !data.payableId) || (!data.receivableId && data.payableId),
  { message: "Cada asignación debe vincular a una CxC o CxP, no ambas" },
);

export const createPaymentSchema = z.object({
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEPOSITO"]),
  date: z.coerce.date(),
  amount: z.number().min(0),
  direction: z.enum(["COBRO", "PAGO"]).optional(),
  description: z.string().min(1).max(500),
  periodId: z.string().min(1),
  contactId: z.string().min(1),
  referenceNumber: z.number().int().positive().optional(),
  operationalDocTypeId: z.string().cuid().optional(),
  accountCode: z.string().min(1).optional(),
  allocations: z.array(allocationInputSchema),
  notes: z.string().optional(),
  creditSources: z.array(creditAllocationSourceSchema).optional(),
});

export const updatePaymentSchema = z.object({
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEPOSITO"]).optional(),
  date: z.coerce.date().optional(),
  amount: z.number().positive().optional(),
  description: z.string().min(1).max(500).optional(),
  referenceNumber: z.number().int().positive().optional(),
  operationalDocTypeId: z.string().cuid().nullish(),
  accountCode: z.string().min(1).nullish(),
  allocations: z.array(allocationInputSchema).optional(),
  notes: z.string().optional(),
});

export const paymentFiltersSchema = z.object({
  status: z.enum(["DRAFT", "POSTED", "VOIDED"]).optional(),
  method: z.enum(["EFECTIVO", "TRANSFERENCIA", "CHEQUE", "DEPOSITO"]).optional(),
  contactId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  periodId: z.string().optional(),
});

export const updateAllocationsSchema = z.object({
  allocations: z.array(allocationInputSchema),
  justification: z.string().min(1).optional(),
});
