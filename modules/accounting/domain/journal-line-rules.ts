import { Money } from "@/modules/shared/domain/value-objects/money";
import {
  JournalLineBothSides,
  JournalLineZeroAmount,
} from "./errors/journal-errors";
import type { JournalLineDraft } from "./journal.entity";
import { LineSide } from "./value-objects/line-side";

/**
 * Raw line input shape consumed by both `createEntry` and `updateEntry` flows
 * — the form submitted by the API/server-action layer (`debit` and `credit`
 * are raw numbers, not `LineSide` constructed yet). Kept in domain so this
 * file is fully application-agnostic.
 */
export interface JournalLineRawInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string | null;
  contactId?: string | null;
}

/**
 * Pure helper that validates raw line inputs against the line-intrinsic
 * invariants that DO NOT require ports:
 *   - I10 both-sides: `debit > 0 && credit > 0` → JournalLineBothSides.
 *   - I10 zero-amount: `debit === 0 && credit === 0` → JournalLineZeroAmount.
 *
 * Parity legacy `journal.service.ts:97-104` (createEntry path) and 371-382
 * (updateEntry path) — both flows duplicated this loop until C2-D-a ciclo 7
 * REFACTOR consolidated it here.
 *
 * Account active/postable, requiresContact, contact active are NOT covered
 * — they require AccountsReadPort + ContactsReadPort and live in
 * `application/journal-line-port-checks.ts` (forthcoming when ciclo 9+
 * lands the first port-dependent RED) per the D-1 split decision.
 *
 * Pure: no I/O, no ports, no side-effects.
 */
export function validateLineRules(
  lines: ReadonlyArray<JournalLineRawInput>,
): void {
  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      throw new JournalLineBothSides();
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new JournalLineZeroAmount();
    }
  }
}

/**
 * Pure helper that maps raw debit/credit numbers to `JournalLineDraft[]`
 * suitable for `Journal.create({ lines })` or `journal.replaceLines(drafts)`.
 *
 * Assumes line rules already validated (both-sides + zero-amount via
 * `validateLineRules`). The ternary `debit > 0 ? LineSide.debit : LineSide.
 * credit` is safe AFTER both-sides has been rejected; without that
 * pre-validation, a line with both > 0 would silently truncate to debit-only.
 *
 * Account active/postable, requiresContact, contact active still require
 * ports — see `application/journal-line-port-checks.ts` (forthcoming).
 *
 * Pure: no I/O, no ports, no side-effects.
 */
export function mapLinesToDrafts(
  lines: ReadonlyArray<JournalLineRawInput>,
): JournalLineDraft[] {
  return lines.map((line) => ({
    accountId: line.accountId,
    side:
      line.debit > 0
        ? LineSide.debit(Money.of(line.debit))
        : LineSide.credit(Money.of(line.credit)),
    description: line.description ?? null,
    contactId: line.contactId ?? null,
  }));
}
