import type {
  DocumentPrintType,
  SignatureLabel,
} from "@/generated/prisma/client";

/** Human-readable labels for DocumentPrintType — used in UI selectors. */
export const DOCUMENT_PRINT_TYPE_LABELS: Record<DocumentPrintType, string> = {
  BALANCE_GENERAL: "Balance General",
  ESTADO_RESULTADOS: "Estado de Resultados",
  COMPROBANTE: "Comprobante",
  DESPACHO: "Despacho",
  VENTA: "Venta",
  COMPRA: "Compra",
  COBRO: "Cobro",
  PAGO: "Pago",
};

/** Human-readable labels for SignatureLabel — used in UI pickers. */
export const SIGNATURE_LABEL_LABELS: Record<SignatureLabel, string> = {
  ELABORADO: "Elaborado por",
  APROBADO: "Aprobado por",
  VISTO_BUENO: "Visto Bueno",
  PROPIETARIO: "Propietario",
  REVISADO: "Revisado por",
  REGISTRADO: "Registrado por",
  CONTABILIZADO: "Contabilizado por",
};
