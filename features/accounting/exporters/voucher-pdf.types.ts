// Input tipado para el exporter de PDF de comprobantes.
// Todos los campos numéricos son strings ya formateados (2 decimales) para
// mantener el exporter puro y determinístico — la conversión Decimal→string
// y el redondeo ocurren en el composer, no aquí.

export type VoucherPdfOrganization = {
  name: string;
  branchName?: string;
  address: string;
  email?: string;
  logoDataUrl?: string;
};

export type VoucherPdfMeta = {
  date: string;
  type: string;
  reference: string;
  exchangeRate: string;
  ufvRate: string;
  payTo: string;
  bank: string;
  amountLiteral: string;
  number: string;
  gestion: string;
  locality: string;
  internalId: string;
  currency: string;
  glosa: string;
};

export type VoucherPdfEntry = {
  accountCode: string;
  accountName: string;
  description: string;
  debitBs: string;
  creditBs: string;
  debitUsd: string;
  creditUsd: string;
};

export type VoucherPdfTotals = {
  debitBs: string;
  creditBs: string;
  debitUsd: string;
  creditUsd: string;
};

export type VoucherPdfSignatureBlock = {
  label: string;
  name?: string;
};

export type VoucherPdfFooterField = {
  label: string;
  value?: string;
};

export type VoucherPdfFooter = {
  nombreApellido: VoucherPdfFooterField;
  ci: VoucherPdfFooterField;
  firma: VoucherPdfFooterField;
};

export type VoucherPdfInput = {
  organization: VoucherPdfOrganization;
  voucher: VoucherPdfMeta;
  entries: VoucherPdfEntry[];
  totals: VoucherPdfTotals;
  signatures: Record<string, VoucherPdfSignatureBlock>;
  // Presente solo cuando DocumentSignatureConfig.showReceiverRow === true.
  // Ausente => no se renderiza la fila de receptor.
  footer?: VoucherPdfFooter;
};

export type ExportVoucherOpts = {
  exchangeRate?: number;
  ufvRate?: string;
};
