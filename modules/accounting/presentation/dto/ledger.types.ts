/**
 * Canonical hex DTO — ledger/trial-balance types (§13.X).
 *
 * Monetary fields serialize as `string` at the JSON boundary
 * (poc-money-math-decimal-convergence — OLEADA 7 POC #2). Service-side
 * arithmetic uses `Prisma.Decimal` internally; `.toFixed(2)` is the
 * serialization point. Consumers parse via `Number()` / `parseFloat()` at
 * display time (UI), preserving wire precision.
 */
import type { AccountType } from "@/generated/prisma/client";

// ── Ledger types ──

export interface LedgerEntry {
  /** cuid del JournalEntry — usado por la UI para enlazar al detail / PDF. */
  entryId: string;
  date: Date;
  entryNumber: number;
  /** Código del voucher type (CD, CV, CP, etc.) — para columna "Tipo". */
  voucherCode: string;
  /** Correlativo formateado tipo "P-001" (prefix + año + número). */
  displayNumber: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
}

/**
 * Paginated ledger DTO at the API/service boundary.
 *
 * Architectural distinction vs `LedgerPageResult` (port):
 *   - `LedgerPageResult` — port contract, monetary fields raw (`unknown`
 *     to abstract Prisma.Decimal), `items: LedgerLineRow[]`.
 *   - `LedgerPaginatedDto` — DTO at API boundary, monetary fields `string`
 *     (serialized via roundHalfUp+toFixed(2)), `items: LedgerEntry[]`.
 *
 * Same separation as LedgerLineRow (port) vs LedgerEntry (DTO) precedent.
 * Cumulative-state DTO 1st evidence (§13 NEW candidate).
 */
export interface LedgerPaginatedDto {
  items: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Opening balance for this page (sum of all debit-credit BEFORE the
   *  current page window), serialized as string via roundHalfUp+toFixed(2).
   *  Page 1 → "0.00". UI banner row hidden when openingBalance === "0.00". */
  openingBalance: string;
}

/**
 * Contact-keyed ledger entry — extends `LedgerEntry` with the columns the
 * contact-ledger detail view requires beyond the account-keyed sister
 * (spec REQ "Contact Ledger Detail" + "Status Column" + "Type Column" +
 * "Fallback — Asiento Manual sin Auxiliar"):
 *
 *   - `status`     — Receivable/Payable status (`PENDING|PARTIAL|PAID|VOIDED`)
 *                    or `null` for rows that have no CxC/CxP parent
 *                    (RECEIPT/PAYMENT/MANUAL). UI maps to es-BO labels +
 *                    derives `ATRASADO` runtime from `dueDate < now`.
 *   - `dueDate`    — fwd from CxC/CxP for the UI to derive ATRASADO. ISO-8601
 *                    `string` at the JSON boundary. `null` when row has no
 *                    receivable/payable parent.
 *   - `voucherTypeHuman` — VoucherType.name (or fallback to code) used by the
 *                    UI "Tipo" column human label.
 *   - `sourceType` — raw discriminator forwarded from the JournalLine ("sale"
 *                    | "purchase" | "payment" | "receipt" | null). UI uses
 *                    this to pick the human "Tipo" override (Cobranza/Pago/etc).
 *   - `paymentMethod` — `EFECTIVO|TRANSFERENCIA|CHEQUE|DEPOSITO` when the
 *                    row originates from a Payment; `null` otherwise.
 *   - `bankAccountName` — bank account display name for transfers/deposits;
 *                    `null` otherwise.
 *   - `withoutAuxiliary` — D4 fallback flag. `true` when the row's parent
 *                    JournalEntry has no source document AND no
 *                    Receivable/Payable matches `journalEntryId`. UI renders
 *                    a "Sin auxiliar" warning row.
 */
export interface ContactLedgerEntry extends LedgerEntry {
  status: string | null;
  dueDate: string | null;
  voucherTypeHuman: string;
  sourceType: string | null;
  paymentMethod: string | null;
  bankAccountName: string | null;
  withoutAuxiliary: boolean;
  /** BF2 — `COBRO` (receipt) | `PAGO` (payment) cuando el row origina en un
   *  Payment; `null` en otro caso. Producción usa `sourceType="payment"`
   *  para ambas direcciones — `paymentDirection` es el único discriminador
   *  fiable para que el helper `renderTipo` elija "Cobranza" vs "Pago". */
  paymentDirection: string | null;
  /** Código del documento operacional físico para la columna "Tipo":
   *  VG (Venta General — Sale), ND/BC (Dispatch), FL/PF/CG/SV (Purchase),
   *  RC/RE/RI/etc (Payment.operationalDocType.code — configurable por org).
   *  Null cuando el row es asiento manual sin auxiliar (UI muestra "Ajuste")
   *  o cuando el Payment no tiene operationalDocType wired. El cobrador usa
   *  este código para identificar qué documento físico ir a buscar. */
  documentTypeCode: string | null;
  /** DT4 — número físico del documento fuente formateado como
   *  `${documentTypeCode}-${String(sequence).padStart(4, "0")}`
   *  (p.ej. "VG-0001", "RC-0042", "ND-0005"). Source per sourceType:
   *    - sale     → Sale.sequenceNumber
   *    - dispatch → Dispatch.sequenceNumber
   *    - purchase → Purchase.sequenceNumber
   *    - payment  → Payment.referenceNumber (nullable — el dato físico
   *      capturado por el operador; si NO está, este campo es null y la
   *      UI cae al `displayNumber` correlative voucher contable).
   *  Null para asiento manual sin auxiliar (no hay documento físico). El
   *  cobrador lee este número en la columna "Nº" para localizar el
   *  documento físico en el archivero (QA Marco). */
  documentReferenceNumber: string | null;
}

/**
 * Paginated contact-ledger DTO at the API/service boundary. Same pagination
 * + cumulative-state contract as `LedgerPaginatedDto` (account-keyed sister)
 * — `items: ContactLedgerEntry[]` carries the enriched rows; `openingBalance`
 * is the Decimal-serialized opening balance for the page window.
 */
export interface ContactLedgerPaginatedDto {
  items: ContactLedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  /** Opening balance for this page (sum of all debit-credit BEFORE the
   *  current page window across the contact's POSTED lines), serialized as
   *  string via roundHalfUp+toFixed(2). Page 1 + no dateFrom → "0.00". */
  openingBalance: string;
}

export interface TrialBalanceRow {
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  totalDebit: string;
  totalCredit: string;
  balance: string;
}

export interface DateRangeFilter {
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Metadata de organización para encabezados de exporters (PDF/XLSX) del
 * Libro Mayor. Shape espejo de TrialBalanceOrgMetadata / WorksheetOrgMetadata:
 * `name` siempre presente (fallback al slug si el profile no resuelve);
 * `taxId`/`address`/`city` null cuando vacíos para que el helper de
 * encabezado los omita gracefully.
 */
export interface LedgerOrgMetadata {
  name: string;
  taxId: string | null;
  address: string | null;
  city: string | null;
  logoUrl: string | null;
}
