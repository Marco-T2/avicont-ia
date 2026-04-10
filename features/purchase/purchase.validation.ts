import { z } from "zod";

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
  date: z.string().min(1), // cadena ISO — convertida a Date por el servicio
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

export const purchaseFiltersSchema = z.object({
  purchaseType: z
    .enum(["FLETE", "POLLO_FAENADO", "COMPRA_GENERAL", "SERVICIO"])
    .optional(),
  status: z.enum(["DRAFT", "POSTED", "LOCKED", "VOIDED"]).optional(),
  contactId: z.string().optional(),
  periodId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export type CreatePurchaseDto = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseDto = z.infer<typeof updatePurchaseSchema>;
export type PurchaseFiltersDto = z.infer<typeof purchaseFiltersSchema>;
