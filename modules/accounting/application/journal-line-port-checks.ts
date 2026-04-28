import { NotFoundError } from "@/features/shared/errors";
import {
  JournalAccountInactive,
  JournalAccountNotPostable,
  JournalContactRequiredForAccount,
} from "../domain/errors/journal-errors";
import type { JournalLineRawInput } from "../domain/journal-line-rules";
import type { AccountsReadPort } from "../domain/ports/accounts-read.port";
import type { ContactsReadPort } from "../domain/ports/contacts-read.port";

/**
 * Async helper that validates raw line inputs against the port-dependent
 * invariants — companion to `validateLineRules` (sync, domain-pure) per the
 * D-1 split decision. These checks REQUIRE `AccountsReadPort` and
 * `ContactsReadPort`, so they cannot live in domain (R1 forbids domain →
 * cross-feature ports).
 *
 * Five invariants enforced (parity legacy `journal.service.ts:385-403`):
 *   1. account NotFound → `NotFoundError("Cuenta {accountId}")`
 *   2. `!account.isActive` → `JournalAccountInactive(account.name)`
 *   3. `!account.isDetail` → `JournalAccountNotPostable()`
 *   4. `account.requiresContact && !line.contactId` →
 *      `JournalContactRequiredForAccount(account.name)`
 *   5. `account.requiresContact && line.contactId` → `contacts.getActiveById`
 *      (throws when missing/inactive)
 *
 * Exported function (NOT a private method on `JournalsService`) by the D-1
 * lock: dependencies are explicit (ports as params), testability is direct,
 * and the helper is reusable by any future use case that needs the same
 * port-dependent line validation. Reused by `validateAndCreateDraft`
 * (createEntry / createAndPost) and `updateEntry` flows.
 *
 * Ordering rule: callers MUST run `validateLineRules` first (sync, no I/O)
 * — this helper assumes line-intrinsic invariants (both-sides, zero-amount)
 * have already been rejected. Mixing the order would issue port reads for
 * lines that domain rules already disqualified.
 */
export async function validateLinesAgainstPorts(
  organizationId: string,
  lines: ReadonlyArray<JournalLineRawInput>,
  accounts: AccountsReadPort,
  contacts: ContactsReadPort,
): Promise<void> {
  for (const line of lines) {
    const account = await accounts.findById(organizationId, line.accountId);
    if (!account) {
      throw new NotFoundError(`Cuenta ${line.accountId}`);
    }
    if (!account.isActive) {
      throw new JournalAccountInactive(account.name);
    }
    if (!account.isDetail) {
      throw new JournalAccountNotPostable();
    }
    if (account.requiresContact) {
      if (!line.contactId) {
        throw new JournalContactRequiredForAccount(account.name);
      }
      await contacts.getActiveById(organizationId, line.contactId);
    }
  }
}
