import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

/**
 * A persisted consumer↔source credit link (the `CreditConsumption` row). This
 * is the QB-style LinkedTxn that makes credit application reversible WITHOUT
 * mutating the source payment's journal entry (design v2 §CENTERPIECE, D-G/D-H).
 *
 * `amount` is a `MonetaryAmount` at the port boundary — the Prisma `Decimal`
 * value-form is confined to the infra adapter (DEC-1: no Prisma.Decimal in
 * domain/application).
 *
 * `consumerPaymentId` is nullable: standalone apply-credits (`applyCreditOnly`)
 * supply credit from a source to a receivable with no consumer payment.
 */
export interface CreditConsumptionLink {
  sourcePaymentId: string;
  receivableId: string;
  amount: MonetaryAmount;
  consumerPaymentId: string | null;
}

/**
 * Input for writing a new credit-consumption link. Same shape as the link,
 * minus nothing — kept as its own type so the write contract is explicit.
 */
export interface WriteCreditConsumptionInput {
  organizationId: string;
  consumerPaymentId: string | null;
  sourcePaymentId: string;
  receivableId: string;
  amount: MonetaryAmount;
}

/**
 * Local port for the `CreditConsumption` bridge table. Tx-aware: every method
 * takes `tx: unknown` (the adapter casts to `Prisma.TransactionClient`), so the
 * link write/read/delete participate in the same atomic edit transaction as the
 * receivable balance restore and the payment aggregate persist.
 */
export interface CreditConsumptionPort {
  /**
   * Persist one credit-consumption link inside the tx. Used by
   * `applyCreditToInvoiceTx` v2 (after reducing the source unappliedAmount and
   * applying to the receivable) to record the reversible link.
   */
  writeTx(tx: unknown, input: WriteCreditConsumptionInput): Promise<void>;

  /**
   * Read all credit-consumption links for a given consumer payment. Authoritative
   * source of truth for `revertCreditTx` (design v2 §3, Scenario H): the prior
   * credit set is server-side, not trusted from the client.
   */
  findByConsumerPaymentIdTx(
    tx: unknown,
    organizationId: string,
    consumerPaymentId: string,
  ): Promise<CreditConsumptionLink[]>;

  /**
   * Delete all credit-consumption links for a given consumer payment. Called by
   * `revertCreditTx` after each receivable balance has been restored.
   */
  deleteByConsumerPaymentIdTx(
    tx: unknown,
    organizationId: string,
    consumerPaymentId: string,
  ): Promise<void>;
}
