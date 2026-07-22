import type {
  CreateJournalEntryInput,
  JournalLineInput,
  JournalEntryWithLines,
} from "../journal.types";

/**
 * Narrow outbound port for the ONE `JournalRepository` method
 * `AutoEntryGenerator` uses: `createWithRetryTx` (R2 paydown). This is
 * DELIBERATELY distinct from the existing `JournalEntriesRepository` port
 * (`./journal-entries.repo`) — that one is aggregate-shaped (`Journal`
 * in/out, UoW-oriented). Auto-entry generation writes through the legacy
 * row-shaped repository method directly (retry-loop over the compound
 * unique index, returns the hydrated `JournalEntryWithLines` row) — do NOT
 * conflate the two ports.
 *
 * Implemented by a thin adapter
 * (`infrastructure/adapters/auto-entry-journal-writer.adapter.ts`) that
 * delegates unchanged to `JournalRepository.createWithRetryTx`.
 *
 * Opaque-token pattern (R5, already closed): `tx` stays `unknown` so this
 * port — and `AutoEntryGenerator` — never import `@/generated/prisma/*`.
 * `status` stays `string` for the same reason (the concrete
 * `JournalEntryStatus` enum is Prisma-generated); the adapter narrows it
 * internally.
 */
export interface AutoEntryJournalWriterPort {
  createWithRetryTx(
    tx: unknown,
    organizationId: string,
    data: Omit<CreateJournalEntryInput, "lines">,
    lines: JournalLineInput[],
    status?: string,
  ): Promise<JournalEntryWithLines>;
}
