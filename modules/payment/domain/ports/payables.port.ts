import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

/**
 * Status snapshot of a payable. Mirror of `ReceivableStatusValue` — see
 * receivables.port.ts for the rationale on duplicating the union here.
 */
export type PayableStatusValue = "PENDING" | "PARTIAL" | "PAID" | "VOIDED";

/**
 * Local cross-feature port for the slice of payables the payment module
 * consumes. Symmetric mirror of `ReceivablesPort` — same shape, same tx-aware
 * contract.
 */
export interface PayablesPort {
  /**
   * Read the payable's current status inside the tx. Returns null when the
   * payable does not exist. Used by the payment orchestrator to filter VOIDED
   * targets BEFORE calling revert.
   */
  getStatusByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<PayableStatusValue | null>;

  applyAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void>;

  revertAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void>;
}
