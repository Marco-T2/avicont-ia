import { InvalidJournalStatus } from "../errors/journal-errors";

export const JOURNAL_ENTRY_STATUSES = [
  "DRAFT",
  "POSTED",
  "LOCKED",
  "VOIDED",
] as const;

export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number];

const ALLOWED: Record<JournalEntryStatus, readonly JournalEntryStatus[]> = {
  DRAFT: ["POSTED"],
  POSTED: ["LOCKED", "VOIDED"],
  LOCKED: ["VOIDED"],
  VOIDED: [],
};

export function parseJournalEntryStatus(value: string): JournalEntryStatus {
  if ((JOURNAL_ENTRY_STATUSES as readonly string[]).includes(value)) {
    return value as JournalEntryStatus;
  }
  throw new InvalidJournalStatus(value);
}

export function canTransition(
  from: JournalEntryStatus,
  to: JournalEntryStatus,
): boolean {
  return ALLOWED[from].includes(to);
}
