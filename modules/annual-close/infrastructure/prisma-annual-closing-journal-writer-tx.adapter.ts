import type { Prisma } from "@/generated/prisma/client";

import type {
  AnnualClosingEntryInput,
  AnnualClosingEntryResult,
  AnnualClosingJournalWriterTxPort,
} from "../domain/ports/annual-closing-journal-writer-tx.port";

/**
 * Phase 4.9 STUB — CC/CA writer scaffolding to keep tsc clean during RED.
 */

interface JournalRepositoryLike {
  createWithRetryTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    data: unknown,
    lines: unknown[],
    status: "DRAFT" | "POSTED",
  ): Promise<{ id: string }>;
}

export type JournalRepositoryFactory = (
  tx: Prisma.TransactionClient,
) => JournalRepositoryLike;

export class PrismaAnnualClosingJournalWriterTxAdapter
  implements AnnualClosingJournalWriterTxPort
{
  constructor(
    private readonly tx: Pick<
      Prisma.TransactionClient,
      "fiscalPeriod" | "voucherTypeCfg" | "journalEntry"
    >,
    private readonly repoFactory: JournalRepositoryFactory,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createAndPost(_input: AnnualClosingEntryInput): Promise<AnnualClosingEntryResult> {
    throw new Error("STUB — Phase 4.10 GREEN pending");
  }
}
