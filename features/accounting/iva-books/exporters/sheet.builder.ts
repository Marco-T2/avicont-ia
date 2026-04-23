/**
 * Definición de columnas SIN para Libro de Compras (23 cols) y Ventas (24 cols).
 *
 * Orden EXACTO de la plantilla oficial SIN Bolivia:
 * - PlantillaRegistro_ComprasEstandar.xlsx
 * - PlantillaRegistro_ventas estandar.xlsx
 *
 * Clave: field → clave en IvaPurchaseBookDTO / IvaSalesBookDTO
 * Header: texto exacto de encabezado SIN
 * Type: "text" | "number" | "date" — determina formato de celda Excel
 */

export type ColumnType = "text" | "number" | "date";

export interface IvaBookColumn {
  header: string;
  field: string;
  type: ColumnType;
  /** Ancho en caracteres Excel (aprox) */
  width: number;
}

// ── Compras — 23 columnas (+ Nº que se genera en el exporter) ─────────────────

export const PURCHASES_COLUMNS: readonly IvaBookColumn[] = [
  { header: "Nº",                                               field: "__rowNum",              type: "number", width: 6  },
  { header: "ESPECIFICACION",                                   field: "codigoAutorizacion",    type: "text",   width: 20 },
  { header: "NIT PROVEEDOR",                                    field: "nitProveedor",          type: "text",   width: 16 },
  { header: "RAZON SOCIAL PROVEEDOR",                          field: "razonSocial",           type: "text",   width: 30 },
  { header: "CODIGO DE AUTORIZACION",                           field: "codigoAutorizacion",    type: "text",   width: 22 },
  { header: "NUMERO FACTURA",                                   field: "numeroFactura",         type: "text",   width: 16 },
  { header: "NUMERO DUI/DIM",                                   field: "__duiDim",              type: "text",   width: 14 },
  { header: "FECHA DE FACTURA/DUI/DIM",                        field: "fechaFactura",          type: "date",   width: 22 },
  { header: "IMPORTE TOTAL COMPRA",                             field: "importeTotal",          type: "number", width: 20 },
  { header: "IMPORTE ICE",                                      field: "importeIce",            type: "number", width: 14 },
  { header: "IMPORTE IEHD",                                     field: "importeIehd",           type: "number", width: 14 },
  { header: "IMPORTE IPJ",                                      field: "importeIpj",            type: "number", width: 14 },
  { header: "TASAS",                                            field: "tasas",                 type: "number", width: 12 },
  { header: "OTRO NO SUJETO A CREDITO FISCAL",                 field: "otrosNoSujetos",        type: "number", width: 28 },
  { header: "IMPORTES EXENTOS",                                 field: "exentos",               type: "number", width: 16 },
  { header: "IMPORTE COMPRAS GRAVADAS A TASA CERO",            field: "tasaCero",              type: "number", width: 32 },
  { header: "SUBTOTAL",                                         field: "subtotal",              type: "number", width: 14 },
  { header: "DESCUENTOS/BONIFICACIONES /REBAJAS SUJETAS AL IVA", field: "codigoDescuentoAdicional", type: "number", width: 38 },
  { header: "IMPORTE GIFT CARD",                                field: "importeGiftCard",       type: "number", width: 16 },
  { header: "IMPORTE BASE CF",                                  field: "baseIvaSujetoCf",       type: "number", width: 16 },
  { header: "CREDITO FISCAL",                                   field: "dfCfIva",               type: "number", width: 16 },
  { header: "TIPO COMPRA",                                      field: "tipoCompra",            type: "number", width: 12 },
  { header: "CODIGO DE CONTROL",                                field: "codigoControl",         type: "text",   width: 18 },
] as const;

// ── Ventas — 24 columnas (+ Nº) ────────────────────────────────────────────────

export const SALES_COLUMNS: readonly IvaBookColumn[] = [
  { header: "Nº",                                               field: "__rowNum",              type: "number", width: 6  },
  { header: "ESPECIFICACION",                                   field: "codigoAutorizacion",    type: "text",   width: 20 },
  { header: "FECHA DE LA FACTURA",                             field: "fechaFactura",          type: "date",   width: 20 },
  { header: "N° DE LA FACTURA",                                field: "numeroFactura",         type: "text",   width: 16 },
  { header: "CODIGO DE AUTORIZACION",                           field: "codigoAutorizacion",    type: "text",   width: 22 },
  { header: "NIT / CI CLIENTE",                                 field: "nitCliente",            type: "text",   width: 16 },
  { header: "COMPLEMENTO",                                      field: "__complemento",         type: "text",   width: 12 },
  { header: "NOMBRE O RAZON SOCIAL",                           field: "razonSocial",           type: "text",   width: 28 },
  { header: "IMPORTE TOTAL DE LA VENTA",                       field: "importeTotal",          type: "number", width: 22 },
  { header: "IMPORTE ICE",                                      field: "importeIce",            type: "number", width: 14 },
  { header: "IMPORTE IEHD",                                     field: "importeIehd",           type: "number", width: 14 },
  { header: "IMPORTE IPJ",                                      field: "importeIpj",            type: "number", width: 14 },
  { header: "TASAS",                                            field: "tasas",                 type: "number", width: 12 },
  { header: "OTROS NO SUJETOS AL IVA",                         field: "otrosNoSujetos",        type: "number", width: 22 },
  { header: "EXPORTACIONES Y OPERACIONES EXENTAS",             field: "exentos",               type: "number", width: 32 },
  { header: "VENTAS GRAVADAS A TASA CERO",                     field: "tasaCero",              type: "number", width: 24 },
  { header: "SUBTOTAL",                                         field: "subtotal",              type: "number", width: 14 },
  { header: "DESCUENTOS, BONIFICACIONES Y REBAJAS SUJETAS AL IVA", field: "codigoDescuentoAdicional", type: "number", width: 40 },
  { header: "IMPORTE GIFT CARD",                                field: "importeGiftCard",       type: "number", width: 16 },
  { header: "IMPORTE BASE PARA DEBITO FISCAL",                 field: "baseIvaSujetoCf",       type: "number", width: 28 },
  { header: "DEBITO FISCAL",                                    field: "dfIva",                 type: "number", width: 14 },
  { header: "ESTADO",                                           field: "estadoSIN",             type: "text",   width: 10 },
  { header: "CODIGO DE CONTROL",                                field: "codigoControl",         type: "text",   width: 18 },
  { header: "TIPO DE VENTA",                                    field: "__tipoVenta",           type: "text",   width: 14 },
] as const;

/**
 * Retorna el conjunto de columnas según el tipo de libro.
 */
export function getColumns(kind: "purchases" | "sales"): readonly IvaBookColumn[] {
  return kind === "purchases" ? PURCHASES_COLUMNS : SALES_COLUMNS;
}

