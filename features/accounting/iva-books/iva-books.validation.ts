import { z } from "zod";

// ── Helpers de Zod ────────────────────────────────────────────────────────────

/**
 * Campo monetario: string numérico no negativo.
 * Acepta strings de Decimal ("1000.00", "0.1300") — se parsea en el service.
 */
const monetaryField = z
  .string()
  .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, {
    message: "Debe ser un número no negativo",
  });

// ── Enums ─────────────────────────────────────────────────────────────────────

const ivaBookStatusEnum = z.enum(["ACTIVE", "VOIDED"]);

const ivaSalesEstadoSINEnum = z.enum(["A", "V", "C", "L"], {
  error: "estadoSIN debe ser uno de: A, V, C, L",
});

// ── Campos monetarios compartidos ─────────────────────────────────────────────

const monetaryFields = {
  importeTotal: monetaryField,
  importeIce: monetaryField,
  importeIehd: monetaryField,
  importeIpj: monetaryField,
  tasas: monetaryField,
  otrosNoSujetos: monetaryField,
  exentos: monetaryField,
  tasaCero: monetaryField,
  subtotal: monetaryField,
  dfIva: monetaryField,
  codigoDescuentoAdicional: monetaryField,
  importeGiftCard: monetaryField,
  baseIvaSujetoCf: monetaryField,
  dfCfIva: monetaryField,
  tasaIva: monetaryField,
} as const;

// ── createPurchaseInputSchema ─────────────────────────────────────────────────

export const createPurchaseInputSchema = z.object({
  ...monetaryFields,
  fechaFactura: z
    .string({ error: "La fecha de factura es requerida" })
    .date("La fecha debe tener formato YYYY-MM-DD"),
  nitProveedor: z.string().min(1, "El NIT del proveedor es requerido"),
  razonSocial: z.string().min(1, "La razón social es requerida"),
  numeroFactura: z.string().min(1, "El número de factura es requerido"),
  codigoAutorizacion: z
    .string()
    .min(1, "El código de autorización es requerido"),
  codigoControl: z.string().optional().default(""),
  tipoCompra: z.number().int().min(1).max(5).default(1),
  fiscalPeriodId: z.string().min(1, "El período fiscal es requerido"),
  purchaseId: z.string().optional(),
  notes: z.string().optional(),
});

export type CreatePurchaseInputDto = z.infer<typeof createPurchaseInputSchema>;

// ── createSaleInputSchema ─────────────────────────────────────────────────────

export const createSaleInputSchema = z.object({
  ...monetaryFields,
  fechaFactura: z
    .string({ error: "La fecha de factura es requerida" })
    .date("La fecha debe tener formato YYYY-MM-DD"),
  nitCliente: z.string().min(1, "El NIT del cliente es requerido"),
  razonSocial: z.string().min(1, "La razón social es requerida"),
  numeroFactura: z.string().min(1, "El número de factura es requerido"),
  codigoAutorizacion: z
    .string()
    .min(1, "El código de autorización es requerido"),
  codigoControl: z.string().optional().default(""),
  estadoSIN: ivaSalesEstadoSINEnum,
  fiscalPeriodId: z.string().min(1, "El período fiscal es requerido"),
  saleId: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateSaleInputDto = z.infer<typeof createSaleInputSchema>;

// ── updatePurchaseInputSchema ─────────────────────────────────────────────────

export const updatePurchaseInputSchema = createPurchaseInputSchema.partial();

export type UpdatePurchaseInputDto = z.infer<typeof updatePurchaseInputSchema>;

// ── updateSaleInputSchema ─────────────────────────────────────────────────────

export const updateSaleInputSchema = createSaleInputSchema.partial();

export type UpdateSaleInputDto = z.infer<typeof updateSaleInputSchema>;

// ── listQuerySchema ───────────────────────────────────────────────────────────

export const listQuerySchema = z.object({
  fiscalPeriodId: z.string().optional(),
  status: ivaBookStatusEnum.optional(),
});

export type ListQueryDto = z.infer<typeof listQuerySchema>;
