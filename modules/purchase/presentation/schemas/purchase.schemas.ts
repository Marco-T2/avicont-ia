import { z } from "zod";

/**
 * Validates purchase presentation inputs (create, update, filter) — migrado
 * bit-exact (POC nuevo A3-C1 + atomic delete A3-C8 commit 4aa8480).
 *
 * Mirror sale precedent `modules/sale/presentation/schemas/sale.schemas.ts`
 * (POC #11.0a A5 β Ciclo 2) modulo Q5 lock Marco (a) mirror legacy estricto:
 * NO `purchaseStatusSchema` (legacy `purchase.validation.ts` NO lo tiene; status
 * endpoint inline schema resolved §13 emergente futuro NO scope creep A3-C1).
 */

const purchaseDetailSchema = z.object({
  description: z.string().min(1).max(500),
  lineAmount: z.number().optional(),
  order: z.number().int().min(0).optional(),
  // Columnas FLETE
  fecha: z.coerce.date().optional(),
  docRef: z.string().max(100).optional(),
  chickenQty: z.number().int().positive().optional(),
  pricePerChicken: z.number().positive().optional(),
  // Columnas POLLO_FAENADO
  productTypeId: z.string().min(1).optional(),
  detailNote: z.string().max(200).optional(),
  boxes: z.number().int().positive().optional(),
  grossWeight: z.number().positive().optional(),
  tare: z.number().min(0).optional(),
  netWeight: z.number().positive().optional(),
  unitPrice: z.number().positive().optional(),
  shrinkage: z.number().min(0).optional(),
  shortage: z.number().min(0).optional(),
  realNetWeight: z.number().positive().optional(),
  // Columnas COMPRA_GENERAL / SERVICIO
  quantity: z.number().positive().optional(),
  expenseAccountId: z.string().min(1).optional(),
});

export const createPurchaseSchema = z.object({
  purchaseType: z.enum(["FLETE", "POLLO_FAENADO", "COMPRA_GENERAL", "SERVICIO"]),
  date: z.string().min(1),
  contactId: z.string().min(1),
  periodId: z.string().min(1),
  description: z.string().min(1).max(500),
  referenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  ruta: z.string().optional(),
  farmOrigin: z.string().optional(),
  chickenCount: z.number().int().positive().optional(),
  shrinkagePct: z.number().min(0).max(100).optional(),
  details: z.array(purchaseDetailSchema).min(1),
});

export const updatePurchaseSchema = z.object({
  date: z.string().optional(),
  contactId: z.string().min(1).optional(),
  description: z.string().min(1).max(500).optional(),
  referenceNumber: z.number().int().positive().optional(),
  notes: z.string().optional(),
  ruta: z.string().optional(),
  farmOrigin: z.string().optional(),
  chickenCount: z.number().int().positive().optional(),
  shrinkagePct: z.number().min(0).max(100).optional(),
  details: z.array(purchaseDetailSchema).optional(),
});

export const purchaseFiltersSchema = z
  .object({
    purchaseType: z
      .enum(["FLETE", "POLLO_FAENADO", "COMPRA_GENERAL", "SERVICIO"])
      .optional(),
    purchaseTypeIn: z
      .array(z.enum(["FLETE", "POLLO_FAENADO", "COMPRA_GENERAL", "SERVICIO"]))
      .optional(),
    status: z.enum(["DRAFT", "POSTED", "LOCKED", "VOIDED"]).optional(),
    contactId: z.string().optional(),
    periodId: z.string().optional(),
    dateFrom: z.coerce.date().optional(),
    dateTo: z.coerce.date().optional(),
  })
  .refine((data) => !(data.purchaseType && data.purchaseTypeIn), {
    message: "purchaseType y purchaseTypeIn son mutuamente exclusivos",
  });
