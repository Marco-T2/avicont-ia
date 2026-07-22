/**
 * Read-only enrichment ports for `LedgerService.getContactLedgerPaginated`
 * (contact-ledger-refactor — C3, design D3 "enrichment in service").
 *
 * The contact-ledger view returns raw `ContactLedgerLineRow[]` from the
 * adapter (pure SQL, no joins to source documents). The application layer
 * hydrates each row's `paymentMethod` / `bankAccountName` / `direction` by
 * looking up the parent Payment via the single batched port below.
 *
 * unified-comprobante-source-of-truth P9 (D6 retirement 3→1): the
 * `ReceivablesContactLedgerPort` / `PayablesContactLedgerPort` enrichment
 * ports (and their row types + Prisma adapters) were RETIRED — `status` and
 * `dueDate` are persisted ON the JE row (`JournalEntry.paymentStatus` /
 * `.dueDate`: stamped at creation, live-synced by the repo write funnel,
 * backfilled for pre-existing rows) and read off it directly. Only the
 * Payment lookup survives — its fields are not denormalized onto the JE.
 *
 * N+1 mitigation (design risk #1): the port exposes a SINGLE batched method
 * `findByJournalEntryIds(orgId, ids)` — the service collects the unique JE
 * ids from the page rows and issues ONE call per page (NOT per row). The
 * returned array is then indexed by `journalEntryId` in O(N) for the merge.
 *
 * Adapter wraps the existing repo:
 *   - PaymentsContactLedgerPort → PaymentRepository.findByJournalEntryIds
 *
 * Concrete adapter wiring lives at the composition root (C4 — when the
 * route handler instantiates the service).
 */

import type { ContactsReadPort } from "./contacts-read.port";

/** Payment enrichment projection — exposes `paymentMethod` + optional
 *  `bankAccountName` for the "Forma de pago" column suffix (spec REQ "Type
 *  Column": "Cobranza (efectivo)" / "Cobranza (transferencia BNB Cta Cte)").
 *
 *  journal-physical-document Phase 5: `documentTypeCode` /
 *  `documentReferenceNumber` REMOVED — read directly from the JE row now.
 *  `direction` STAYS because BF2 uses it to render "Cobranza" vs "Pago" in
 *  the human "Tipo" label when `sourceType === "payment"`. */
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
 *  throws a clear error when called without these wired.
 *
 *  P9 (D6 retirement 3→1): shrank from 5 to 3 collaborators — the
 *  `receivables`/`payables` enrichment arms were retired (estado/dueDate
 *  read off the JE row). */
export interface ContactLedgerEnrichmentDeps {
  contacts: ContactsReadPort;
  payments: PaymentsContactLedgerPort;
  controlAccountCodes: ControlAccountCodesReadPort;
}
