import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

/**
 * Status snapshot of a receivable as seen by the payment orchestrator. Mirrors
 * the four states of `ReceivableStatus` — duplicated here as a string union so
 * this port does not import from `modules/receivables/...` (cross-feature
 * coupling stays at the adapter boundary).
 */
export type ReceivableStatusValue = "PENDING" | "PARTIAL" | "PAID" | "VOIDED";

/**
 * Per-AR metadata needed by `buildPaymentGlosa` (REQ-GE-2, design D5).
 *
 * `sourceTypeCode` denormalised from Phase 0 (Batch A) migration —
 * "VG" | "ND" | "BC" | null (orphan AR, source-doc deleted; builder falls
 * back to literal "DOC-<refNo>" per design D5).
 * `referenceNumber` and `sourceDate` come from the joined source document
 * (Sale or Dispatch). `sourceDate` MUST be in organization-local timezone —
 * adapters are responsible for the TZ normalization per design D6 contract.
 */
export interface ReceivableGlosaMeta {
  id: string;
  sourceTypeCode: string | null;
  referenceNumber: string;
  sourceDate: Date;
}

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
   * Apply an allocation: increases paid by amount, decreases balance, and
   * advances status (PENDING → PARTIAL/PAID). Throws domain errors from the
   * receivables entity — `PAYMENT_ALLOCATION_TARGET_VOIDED` (shared) when the
   * target is VOIDED, `PAYMENT_ALLOCATION_EXCEEDS_BALANCE` (shared) when the
   * amount exceeds the available balance, `ALLOCATION_MUST_BE_POSITIVE`
   * (module-local) when amount ≤ 0, and `NotFoundError` when the target is
   * missing. The payment orchestrator does NOT pre-check — invariants live in
   * the entity (R9), the entity is the only guard.
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

  /**
   * Read per-AR metadata needed by `buildPaymentGlosa` for the COBRO glosa
   * (REQ-GE-2 LOOKUP-B). Returns one entry per resolved id; ids not present
   * are silently omitted (caller falls back to "DOC-<refNo>" for orphan rows
   * via the builder's NULL sourceTypeCode branch).
   *
   * Adapter responsibility: JOIN AccountsReceivable.sourceId to the source
   * document (Sale or Dispatch) to obtain `referenceNumber` and `sourceDate`,
   * read denormalised `sourceTypeCode` directly from AccountsReceivable, and
   * normalize `sourceDate` to organization-local timezone before returning
   * (per design D6).
   */
  findGlosaMetaTx(
    tx: unknown,
    organizationId: string,
    arIds: string[],
  ): Promise<ReceivableGlosaMeta[]>;
}
