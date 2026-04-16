import { z } from "zod";

/**
 * Schema de validación para los query params de GET /dispatches-hub.
 *
 * Covers: REQ-3 (type), REQ-4 (dateFrom/dateTo), REQ-5 (status),
 *         plus contactId, periodId, limit, offset (D6).
 */
export const hubQuerySchema = z.object({
  type: z
    .enum(["VENTA_GENERAL", "NOTA_DESPACHO", "BOLETA_CERRADA"])
    .optional(),

  status: z
    .enum(["DRAFT", "POSTED", "LOCKED", "VOIDED"])
    .optional(),

  contactId: z.string().optional(),
  periodId: z.string().optional(),

  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),

  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type HubQueryDto = z.infer<typeof hubQuerySchema>;
