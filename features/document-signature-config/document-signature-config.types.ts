import type {
  DocumentSignatureConfig,
  DocumentPrintType,
  SignatureLabel,
} from "@/generated/prisma/client";
import type { UpdateSignatureConfigInput as UpdateSignatureConfigInputFromSchema } from "./document-signature-config.validation";

export type { DocumentSignatureConfig, DocumentPrintType, SignatureLabel };

/** Shape returned by service.listAll — one per docType, flat, no DB ids. */
export interface DocumentSignatureConfigView {
  documentType: DocumentPrintType;
  labels: SignatureLabel[];
  showReceiverRow: boolean;
}

/** Input accepted by service.upsert — mirrors the zod schema. */
export type UpdateSignatureConfigInput = UpdateSignatureConfigInputFromSchema;

/** The canonical 8 document print types (ordered for UI display). */
export const ALL_DOCUMENT_PRINT_TYPES: readonly DocumentPrintType[] = [
  "BALANCE_GENERAL",
  "ESTADO_RESULTADOS",
  "COMPROBANTE",
  "DESPACHO",
  "VENTA",
  "COMPRA",
  "COBRO",
  "PAGO",
] as const;
