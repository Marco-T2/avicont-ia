/**
 * Narrow read-only snapshot of an account as seen by the journal use cases.
 * Carries exactly the fields needed to enforce I3 (account postable) and I4
 * (requiresContact). Defined locally so the port does not import from
 * `features/accounting`.
 *
 * Divergence note vs `modules/payment/domain/ports/accounting.port.ts`:
 * payment looks up accounts by `code` inside the tx (`findAccountByCodeTx`),
 * accounting looks them up by `id` outside the tx (matching legacy
 * `journal.service.ts:154` which loads accounts pre-tx for validation).
 * Different semantics — promotion to shared/ would require reconciling both,
 * not trivial.
 */
export interface AccountReadDto {
  id: string;
  name: string;
  isActive: boolean;
  isDetail: boolean;
  requiresContact: boolean;
}

/**
 * Read-only port for accounts. Non-tx — accounts are loaded BEFORE the UoW
 * tx opens (parity with legacy `accountsRepo.findById` calls in createEntry).
 * The adapter MUST return null when the account does not exist; the use case
 * surfaces NotFoundError.
 */
export interface AccountsReadPort {
  findById(
    organizationId: string,
    accountId: string,
  ): Promise<AccountReadDto | null>;
}
