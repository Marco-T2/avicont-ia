import { z } from "zod";

const dispatchDetailSchema = z.object({
  productTypeId: z.string().min(1).optional(),
  detailNote: z.string().max(200).optional(),
  description: z.string().min(1).max(200),
  boxes: z.number().int().min(0), // 0 allowed: trozado sin cajas (mobile)
  grossWeight: z.number().positive(),
  unitPrice: z.number().positive(),
  shortage: z.number().min(0).optional(), // BC only: faltante
  order: z.number().int().min(0),
});

export const createDispatchSchema = z.object({
  dispatchType: z.enum(["NOTA_DESPACHO", "BOLETA_CERRADA"]),
  date: z.coerce.date(),
  contactId: z.string().min(1),
  // periodId is optional: mobile offline omits it and the service resolves it
  // from the date; the web always sends it explicitly (retrocompatible).
  periodId: z.string().min(1).optional(),
  description: z.string().min(1).max(500),
  referenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  farmOrigin: z.string().optional(),
  chickenCount: z.number().int().positive().optional(),
  shrinkagePct: z.number().min(0).max(100).optional(),
  details: z.array(dispatchDetailSchema).min(0),
  // clientId: mobile app generates a UUID per sale for idempotency;
  // web omits it (retrocompatible). The service deduplicates on this key.
  clientId: z.string().optional(),
});

export const updateDispatchSchema = z.object({
  date: z.coerce.date().optional(),
  contactId: z.string().min(1).optional(),
  description: z.string().min(1).max(500).optional(),
  referenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  farmOrigin: z.string().optional(),
  chickenCount: z.number().int().positive().optional(),
  shrinkagePct: z.number().min(0).max(100).optional(),
  details: z.array(dispatchDetailSchema).optional(),
});

export const dispatchFiltersSchema = z.object({
  dispatchType: z.enum(["NOTA_DESPACHO", "BOLETA_CERRADA"]).optional(),
  status: z.enum(["DRAFT", "POSTED", "VOIDED"]).optional(),
  contactId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  periodId: z.string().optional(),
});
