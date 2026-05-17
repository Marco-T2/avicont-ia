/**
 * Read-only enrichment ports for `LedgerService.getContactLedgerPaginated`
 * (contact-ledger-refactor — C3, design D3 "enrichment in service").
 *
 * The contact-ledger view returns raw `ContactLedgerLineRow[]` from the
 * adapter (pure SQL, no joins to source documents). The application layer
 * hydrates each row's `status` / `paymentMethod` / `bankAccount` by looking
 * up the parent CxC / CxP / Payment via these batched ports.
 *
 * N+1 mitigation (design risk #1): each port exposes a SINGLE batched method
 * `findByJournalEntryIds(orgId, ids)` — the service collects the unique JE
 * ids from the page rows and issues ONE call per port (3 lookups total per
 * page, NOT 3 per row). The returned arrays are then indexed by
 * `journalEntryId` in O(N) for the enrichment merge.
 *
 * Adapters wrap the existing repos:
 *   - ReceivablesContactLedgerPort → ReceivableRepository.findByJournalEntryIds
 *   - PayablesContactLedgerPort    → PayableRepository.findByJournalEntryIds
 *   - PaymentsContactLedgerPort    → PaymentRepository.findByJournalEntryIds
 *
 * Concrete adapter wiring lives at the composition root (C4 — when the
 * route handler instantiates the service).
 */

import type { ContactsReadPort } from "./contacts-read.port";

/** Receivable enrichment projection — the minimum fields the service needs
 *  to derive `status` (PENDIENTE/PARCIAL/PAGADO/CANCELADO) + ATRASADO (when
 *  status ∈ {PENDIENTE, PARCIAL} AND dueDate < now). `journalEntryId` is the
 *  join key. Status mirrors `ReceivableStatus` domain values (PENDING / PARTIAL
 *  / PAID / VOIDED) — service maps to UI-facing labels at the DTO boundary.
 *
 *  `documentTypeCode` carries el código operacional físico del documento
 *  fuente (VG para Sale, ND/BC para Dispatch según DispatchType enum). Null
 *  cuando la receivable no tiene sourceId resoluble (sourceType="manual").
 *
 *  `documentReferenceNumber` es el número físico ya formateado
 *  (`"${code}-${seq padded(4)}"`, p.ej. `"VG-0001"`/`"ND-0005"`). Null cuando
 *  el sourceType no resuelve a un documento físico o el sequence no está
 *  disponible. */
export interface ReceivableLedgerEnrichmentRow {
  journalEntryId: string;
  status: string;
  dueDate: Date | null;
  documentTypeCode: string | null;
  documentReferenceNumber: string | null;
}

/** Payable enrichment projection — sister de Receivable. `documentTypeCode`
 *  resuelve desde Purchase.purchaseType (FL/PF/CG/SV) cuando sourceType="purchase";
 *  null para sourceType="manual". `documentReferenceNumber` formateado
 *  `"${code}-${seq padded(4)}"` desde Purchase.sequenceNumber; null cuando
 *  no aplica. */
export interface PayableLedgerEnrichmentRow {
  journalEntryId: string;
  status: string;
  dueDate: Date | null;
  documentTypeCode: string | null;
  documentReferenceNumber: string | null;
}

/** Payment enrichment projection — exposes `paymentMethod` + optional
 *  `bankAccountName` for the "Forma de pago" column suffix (spec REQ "Type
 *  Column": "Cobranza (efectivo)" / "Cobranza (transferencia BNB Cta Cte)").
 *
 *  `documentTypeCode` carries el código del `OperationalDocType` configurado
 *  por la org (ej. "RC"=Recibo de Cobro, "RE"=Recibo de Egreso, "RI"=Recibo
 *  Interno). Null cuando el Payment no tiene operationalDocType wired
 *  (orgs nuevas o payments legacy pre-OperationalDocType). */
export interface PaymentLedgerEnrichmentRow {
  journalEntryId: string;
  /** Native PaymentMethod enum value: EFECTIVO | TRANSFERENCIA | CHEQUE | DEPOSITO. */
  paymentMethod: string;
  /** Bank account display name when method is transfer/deposit; null
   *  otherwise. */
  bankAccountName: string | null;
  /** "COBRO" (Receipt) | "PAGO" (Payment) — used to pick "Cobranza" vs "Pago"
   *  human label when sourceType doesn't disambiguate. */
  direction: string;
  documentTypeCode: string | null;
  /** DT4 — número físico ya formateado `"${code}-${ref padded(4)}"`
   *  (p.ej. `"RC-0042"`). Source: `Payment.referenceNumber` (nullable Int —
   *  el dato físico capturado por el operador). Null cuando NO hay
   *  documentTypeCode wired O NO hay referenceNumber capturado — en ese caso
   *  el service no puede armar el string y el campo del DTO también es null;
   *  la UI cae al `displayNumber` correlative voucher contable. */
  documentReferenceNumber: string | null;
}

export interface ReceivablesContactLedgerPort {
  findByJournalEntryIds(
    organizationId: string,
    journalEntryIds: string[],
  ): Promise<ReceivableLedgerEnrichmentRow[]>;
}

export interface PayablesContactLedgerPort {
  findByJournalEntryIds(
    organizationId: string,
    journalEntryIds: string[],
  ): Promise<PayableLedgerEnrichmentRow[]>;
}

export interface PaymentsContactLedgerPort {
  findByJournalEntryIds(
    organizationId: string,
    journalEntryIds: string[],
  ): Promise<PaymentLedgerEnrichmentRow[]>;
}

/** Org-wide CxC/CxP control account codes used by the service to scope the
 *  contact-ledger query to control-account movements only.
 *
 *  BF1 — fixes duplicate-rows bug where a single JE with debit+credit lines
 *  both tagged with `contactId` (header surface + line surface) surfaces both
 *  legs in the ledger (one Debe + one Haber for the SAME entry). The Prisma
 *  adapter narrows the where clause to `account.code IN [cxc, cxp]` so
 *  contrapartida lines (Caja, Ventas, etc) are dropped. The "manual sin
 *  auxiliar" (D4) semantics are preserved: a JE that touches the CxC/CxP
 *  account but has no Receivable/Payable parent still surfaces — the filter
 *  only drops lines OFF the control accounts. */
export interface ControlAccountCodesReadPort {
  getControlAccountCodes(
    organizationId: string,
  ): Promise<{ cxcAccountCode: string; cxpAccountCode: string }>;
}

/** Bag of enrichment collaborators injected into `LedgerService` for the
 *  contact-ledger use case. Optional at the ctor (back-compat with sister
 *  tests that don't exercise contact-ledger) — `getContactLedgerPaginated`
 *  throws a clear error when called without these wired. */
export interface ContactLedgerEnrichmentDeps {
  contacts: ContactsReadPort;
  receivables: ReceivablesContactLedgerPort;
  payables: PayablesContactLedgerPort;
  payments: PaymentsContactLedgerPort;
  controlAccountCodes: ControlAccountCodesReadPort;
}
