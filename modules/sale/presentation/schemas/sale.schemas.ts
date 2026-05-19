import { z } from "zod";

/**
 * Validates sale presentation inputs (create, update, filter, status) — migrado
 * bit-exact (POC #11.0a A5 β + POC nuevo A3-C7 atomic delete commit ad36da2).
 */

const saleDetailSchema = z.object({
  description: z.string().max(500).default(""),
  lineAmount: z.number().optional(),
  order: z.number().int().min(0).optional(),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().positive().optional(),
  incomeAccountId: z.string().min(1),
});

export const createSaleSchema = z.object({
  date: z.string().min(1),
  contactId: z.string().min(1),
  periodId: z.string().min(1),
  description: z.string().min(1).max(500),
  referenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  details: z.array(saleDetailSchema).min(1),
});

export const updateSaleSchema = z.object({
  date: z.string().optional(),
  contactId: z.string().min(1).optional(),
  description: z.string().min(1).max(500).optional(),
  referenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  details: z.array(saleDetailSchema).optional(),
});

export const saleFiltersSchema = z.object({
  status: z.enum(["DRAFT", "POSTED", "LOCKED", "VOIDED"]).optional(),
  contactId: z.string().optional(),
  periodId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const saleStatusSchema = z.object({
  status: z.enum(["POSTED", "VOIDED"]),
  justification: z.string().min(10).optional(),
});
