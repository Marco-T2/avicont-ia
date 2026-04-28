import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

/**
 * Status snapshot of a receivable as seen by the payment orchestrator. Mirrors
 * the four states of `ReceivableStatus` — duplicated here as a string union so
 * this port does not import from `modules/receivables/...` (cross-feature
 * coupling stays at the adapter boundary).
 */
export type ReceivableStatusValue = "PENDING" | "PARTIAL" | "PAID" | "VOIDED";

/**
 * Local cross-feature port for the slice of receivables the payment module
 * consumes. The adapter wraps the receivables module's application service —
 * the existing `applyAllocation` / `revertAllocation` use cases (Fase B) +
 * a narrow status read used by the payment orchestrator to skip VOIDED
 * targets on revert (legacy parity, see §8.6 architecture.md).
 *
 * Tx-aware: signatures take `tx: unknown`; adapter casts internally.
 */
export interface ReceivablesPort {
  /**
   * Read the receivable's current status inside the tx. Returns null when the
   * receivable does not exist. Used by the payment orchestrator to filter
   * VOIDED targets BEFORE calling revert (legacy parity — apply throws on
   * VOIDED, revert silently skips, by design).
   */
  getStatusByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<ReceivableStatusValue | null>;

  /**
   * Read the receivable's current balance inside the tx. Returns null when
   * the receivable does not exist. Used by the payment orchestrator to emit
   * the legacy `PAYMENT_ALLOCATION_EXCEEDS_BALANCE` error code BEFORE
   * delegating to the receivables-module `applyAllocation` use case (which
   * throws its own `ALLOCATION_EXCEEDS_BALANCE` — different code, different
   * message). Legacy reference:
   *   features/payment/payment.service.ts ~line 156 (createAndPost),
   *   ~line 401 (post), ~line 703 (updateAllocations),
   *   ~line 1037 (updatePostedPaymentTx), ~line 1138 (applyCreditToInvoice).
   */
  getBalanceByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<number | null>;

  /**
   * Apply an allocation: increases paid by amount, decreases balance, and
   * advances status (PENDING → PARTIAL/PAID). Throws domain errors from the
   * receivables entity (CannotApplyToVoidedReceivable, AllocationExceedsBalance,
   * AllocationMustBePositive) and NotFoundError when the target is missing.
   */
  applyAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void>;

  /**
   * Revert an allocation: decreases paid by amount, restores balance, walks
   * status back. Throws CannotRevertOnVoidedReceivable / RevertExceedsPaid /
   * RevertMustBePositive — the orchestrator filters VOIDED targets before
   * invoking, so the throw on VOIDED never fires in the happy path.
   */
  revertAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void>;
}
