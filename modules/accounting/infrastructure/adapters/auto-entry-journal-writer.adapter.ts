import "server-only";
import type { Prisma, JournalEntryStatus } from "@/generated/prisma/client";
import type {
  CreateJournalEntryInput,
  JournalLineInput,
  JournalEntryWithLines,
} from "@/modules/accounting/domain/journal.types";
import type { AutoEntryJournalWriterPort } from "@/modules/accounting/domain/ports/auto-entry-journal-writer.port";
import { JournalRepository } from "../prisma-journal-entries.repo";

/**
 * Adapter for `AutoEntryJournalWriterPort` (R2 paydown). Thin delegation to
 * the EXISTING `JournalRepository.createWithRetryTx` (left UNCHANGED — zero
 * risk to the retry-loop / voucher-number-contention logic). Narrows the
 * opaque `tx: unknown` / `status?: string` port params to the concrete
 * Prisma types the repository expects (infra is R5-exempt).
 */
export class AutoEntryJournalWriterAdapter implements AutoEntryJournalWriterPort {
  private readonly repo: JournalRepository;

  constructor(repo?: JournalRepository) {
    this.repo = repo ?? new JournalRepository();
  }

  async createWithRetryTx(
    tx: unknown,
    organizationId: string,
    data: Omit<CreateJournalEntryInput, "lines">,
    lines: JournalLineInput[],
    status?: string,
  ): Promise<JournalEntryWithLines> {
    return this.repo.createWithRetryTx(
      tx as Prisma.TransactionClient,
      organizationId,
      data,
      lines,
      status as JournalEntryStatus | undefined,
    );
  }
}
