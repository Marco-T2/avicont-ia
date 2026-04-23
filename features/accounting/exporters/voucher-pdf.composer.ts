// Composer: toma un JournalEntry (con lines, account, contact, voucherType),
// OrgProfile y DocumentSignatureConfigView, y produce un VoucherPdfInput
// totalmente serializado a strings listos para el exporter.
//
// Responsabilidades:
//  - Decimal → string con 2 decimales
//  - Cálculo de USD = Bs / exchangeRate (cuando rate > 0)
//  - Totales sumados exactos
//  - Monto en letras vía amountToWordsEs
//  - Mapeo de SignatureLabel → clave camelCase + label visual
//  - Formato voucher.number = prefix-####

import type { OrgProfile } from "@/generated/prisma/client";
import type { JournalEntryWithLines } from "@/features/accounting/journal.types";
import type { DocumentSignatureConfigView, SignatureLabel } from "@/features/document-signature-config/document-signature-config.types";
import type {
  VoucherPdfInput,
  VoucherPdfOrganization,
  VoucherPdfMeta,
  VoucherPdfEntry,
  VoucherPdfTotals,
  VoucherPdfSignatureBlock,
  VoucherPdfFooter,
} from "./voucher-pdf.types";
import { amountToWordsEs } from "./amount-to-words";
import { formatCorrelativeNumber } from "@/features/accounting/correlative.utils";

type ComposeOpts = {
  exchangeRate?: number;
  ufvRate?: string;
  locality?: string;
  gestion?: string;
};

// ── Helpers ──

function toFixed2(value: { toString(): string }): string {
  return Number(value.toString()).toFixed(2);
}

function toUsd(bsString: string, rate: number | undefined): string {
  if (!rate || rate <= 0) return "";
  const bs = Number(bsString);
  if (!Number.isFinite(bs)) return "";
  return (Math.round((bs / rate) * 100) / 100).toFixed(2);
}

function sumBs(values: string[]): string {
  const total = values.reduce((acc, v) => acc + Number(v), 0);
  return total.toFixed(2);
}

function formatDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear() % 100).padStart(2, "0");
  return `${dd}/${mm}/${yy}`;
}

function joinAddress(profile: OrgProfile): string {
  const parts = [profile.direccion, profile.ciudad].filter((p): p is string => Boolean(p && p.trim()));
  return parts.join(", ");
}

function buildOrganization(profile: OrgProfile | null, logoDataUrl: string | undefined): VoucherPdfOrganization {
  if (!profile) {
    return { name: "", address: "", logoDataUrl };
  }
  return {
    name: profile.razonSocial ?? "",
    address: joinAddress(profile),
    logoDataUrl,
  };
}

const SIGNATURE_LABEL_TO_KEY: Record<SignatureLabel, string> = {
  ELABORADO: "elaborado",
  APROBADO: "aprobado",
  VISTO_BUENO: "vistoBueno",
  PROPIETARIO: "propietario",
  REVISADO: "revisado",
  REGISTRADO: "registrado",
  CONTABILIZADO: "contabilizado",
};

const SIGNATURE_LABEL_TO_DISPLAY: Record<SignatureLabel, string> = {
  ELABORADO: "ELABORADO",
  APROBADO: "APROBADO",
  VISTO_BUENO: "V°B°",
  PROPIETARIO: "PROPIETARIO",
  REVISADO: "REVISADO",
  REGISTRADO: "REGISTRADO",
  CONTABILIZADO: "CONTABILIZADO",
};

function buildSignatures(sigConfig: DocumentSignatureConfigView): Record<string, VoucherPdfSignatureBlock> {
  const result: Record<string, VoucherPdfSignatureBlock> = {};
  for (const label of sigConfig.labels) {
    const key = SIGNATURE_LABEL_TO_KEY[label];
    const display = SIGNATURE_LABEL_TO_DISPLAY[label];
    result[key] = { label: display };
  }
  return result;
}

function buildFooter(sigConfig: DocumentSignatureConfigView): VoucherPdfFooter | undefined {
  if (!sigConfig.showReceiverRow) return undefined;
  return {
    nombreApellido: { label: "Nombre y Apellido" },
    ci: { label: "C.I." },
    firma: { label: "Firma" },
  };
}

function deriveBank(entry: JournalEntryWithLines): string {
  const creditLine = entry.lines.find((l) => Number(l.credit.toString()) > 0);
  return creditLine?.account.name ?? "";
}

// "Comprobante de Egreso" → "EGRESO", "Comprobante de Ingreso" → "INGRESO"
// Tomamos la última palabra (excluye "Comprobante", "de") y uppercase.
// Si el name es una sola palabra, devuelve todo en uppercase.
function shortVoucherType(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const words = trimmed.split(/\s+/);
  const last = words[words.length - 1];
  return last.toUpperCase();
}

function buildVoucherMeta(
  entry: JournalEntryWithLines,
  totalDebitBs: string,
  opts: ComposeOpts,
): VoucherPdfMeta {
  // Formato oficial del sistema: {prefix}{YY}{MM}-{000000}, e.g. "E2604-000001".
  // Fallback al formato viejo (prefix-NNNN) si el prefix no cumple el contrato.
  const formatted = formatCorrelativeNumber(entry.voucherType.prefix, entry.date, entry.number);
  const number = formatted ?? `${entry.voucherType.prefix}-${String(entry.number).padStart(4, "0")}`;
  const exchangeRate = opts.exchangeRate && opts.exchangeRate > 0 ? opts.exchangeRate.toString() : "";

  return {
    date: formatDate(entry.date),
    type: shortVoucherType(entry.voucherType.name),
    reference: entry.referenceNumber != null ? String(entry.referenceNumber) : "",
    exchangeRate,
    ufvRate: opts.ufvRate ?? "",
    payTo: entry.contact?.name ?? "",
    bank: deriveBank(entry),
    amountLiteral: amountToWordsEs(totalDebitBs),
    number,
    gestion: opts.gestion ?? "",
    locality: opts.locality ?? "",
    internalId: entry.id,
    currency: "BS",
    glosa: entry.description ?? "",
  };
}

function buildEntries(entry: JournalEntryWithLines, rate: number | undefined): VoucherPdfEntry[] {
  return entry.lines.map((line) => {
    const debitBs = toFixed2(line.debit);
    const creditBs = toFixed2(line.credit);
    return {
      accountCode: line.account.code,
      accountName: line.account.name,
      description: line.description ?? "",
      debitBs,
      creditBs,
      debitUsd: toUsd(debitBs, rate),
      creditUsd: toUsd(creditBs, rate),
    };
  });
}

function buildTotals(entries: VoucherPdfEntry[], rate: number | undefined): VoucherPdfTotals {
  const debitBs = sumBs(entries.map((e) => e.debitBs));
  const creditBs = sumBs(entries.map((e) => e.creditBs));
  const debitUsd = rate && rate > 0 ? toUsd(debitBs, rate) : "";
  const creditUsd = rate && rate > 0 ? toUsd(creditBs, rate) : "";
  return { debitBs, creditBs, debitUsd, creditUsd };
}

// ── Public API ──

export function buildVoucherPdfInput(
  entry: JournalEntryWithLines,
  profile: OrgProfile | null,
  sigConfig: DocumentSignatureConfigView,
  logoDataUrl: string | undefined,
  opts: ComposeOpts,
): VoucherPdfInput {
  const rate = opts.exchangeRate;
  const entries = buildEntries(entry, rate);
  const totals = buildTotals(entries, rate);
  const voucher = buildVoucherMeta(entry, totals.debitBs, opts);

  return {
    organization: buildOrganization(profile, logoDataUrl),
    voucher,
    entries,
    totals,
    signatures: buildSignatures(sigConfig),
    footer: buildFooter(sigConfig),
  };
}
