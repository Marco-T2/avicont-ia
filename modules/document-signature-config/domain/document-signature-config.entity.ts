/** R5 absoluta — local const arrays + types, ZERO Prisma imports. */

export const ALL_DOCUMENT_PRINT_TYPES = [
  "BALANCE_GENERAL",
  "ESTADO_RESULTADOS",
  "COMPROBANTE",
  "DESPACHO",
  "VENTA",
  "COMPRA",
  "COBRO",
  "PAGO",
] as const;

export type DocumentPrintType = (typeof ALL_DOCUMENT_PRINT_TYPES)[number];

export const ALL_SIGNATURE_LABELS = [
  "ELABORADO",
  "APROBADO",
  "VISTO_BUENO",
  "PROPIETARIO",
  "REVISADO",
  "REGISTRADO",
  "CONTABILIZADO",
] as const;

export type SignatureLabel = (typeof ALL_SIGNATURE_LABELS)[number];

export interface DocumentSignatureConfigProps {
  id: string;
  organizationId: string;
  documentType: DocumentPrintType;
  labels: SignatureLabel[];
  showReceiverRow: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertDocumentSignatureConfigInput {
  labels: SignatureLabel[];
  showReceiverRow: boolean;
}

export interface DocumentSignatureConfigSnapshot {
  id: string;
  organizationId: string;
  documentType: DocumentPrintType;
  labels: SignatureLabel[];
  showReceiverRow: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class DocumentSignatureConfig {
  private constructor(private readonly props: DocumentSignatureConfigProps) {}

  static create(
    organizationId: string,
    documentType: DocumentPrintType,
    input: UpsertDocumentSignatureConfigInput,
  ): DocumentSignatureConfig {
    const now = new Date();
    return new DocumentSignatureConfig({
      id: crypto.randomUUID(),
      organizationId,
      documentType,
      labels: input.labels,
      showReceiverRow: input.showReceiverRow,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(
    props: DocumentSignatureConfigProps,
  ): DocumentSignatureConfig {
    return new DocumentSignatureConfig(props);
  }

  get id(): string {
    return this.props.id;
  }
  get organizationId(): string {
    return this.props.organizationId;
  }
  get documentType(): DocumentPrintType {
    return this.props.documentType;
  }
  get labels(): SignatureLabel[] {
    return this.props.labels;
  }
  get showReceiverRow(): boolean {
    return this.props.showReceiverRow;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateConfig(input: UpsertDocumentSignatureConfigInput): void {
    (this.props as { labels: SignatureLabel[] }).labels = input.labels;
    (this.props as { showReceiverRow: boolean }).showReceiverRow =
      input.showReceiverRow;
    (this.props as { updatedAt: Date }).updatedAt = new Date();
  }

  toSnapshot(): DocumentSignatureConfigSnapshot {
    return {
      id: this.props.id,
      organizationId: this.props.organizationId,
      documentType: this.props.documentType,
      labels: [...this.props.labels],
      showReceiverRow: this.props.showReceiverRow,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
    };
  }
}
