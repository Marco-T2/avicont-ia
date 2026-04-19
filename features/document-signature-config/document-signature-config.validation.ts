import { z } from "zod";

/** 7 SignatureLabel enum values (REQ-OP.5). */
export const signatureLabelEnum = z.enum([
  "ELABORADO",
  "APROBADO",
  "VISTO_BUENO",
  "PROPIETARIO",
  "REVISADO",
  "REGISTRADO",
  "CONTABILIZADO",
]);

/** 8 DocumentPrintType enum values (REQ-OP.4). */
export const documentPrintTypeEnum = z.enum([
  "BALANCE_GENERAL",
  "ESTADO_RESULTADOS",
  "COMPROBANTE",
  "DESPACHO",
  "VENTA",
  "COMPRA",
  "COBRO",
  "PAGO",
]);

/**
 * Zod schema for PATCH /signature-configs/[documentType].
 *
 * - `labels` may be empty; duplicates rejected; order preserved as submitted.
 * - `showReceiverRow` is a required boolean.
 *
 * Covers REQ-OP.5.
 */
export const updateSignatureConfigSchema = z.object({
  labels: z
    .array(signatureLabelEnum)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "duplicate labels",
    }),
  showReceiverRow: z.boolean(),
});

export type UpdateSignatureConfigInput = z.infer<
  typeof updateSignatureConfigSchema
>;
