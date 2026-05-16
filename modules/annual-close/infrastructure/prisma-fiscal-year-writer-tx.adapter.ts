import type { Prisma } from "@/generated/prisma/client";

import type {
  FiscalYearWriterTxPort,
  MarkClosedInput,
  MarkClosedResult,
  UpsertOpenInput,
  UpsertOpenResult,
} from "../domain/ports/fiscal-year-writer-tx.port";

/**
 * Phase 4.3 STUB — Tx-bound writer scaffolding to keep tsc green during RED.
 */
export class PrismaFiscalYearWriterTxAdapter implements FiscalYearWriterTxPort {
  constructor(private readonly tx: Pick<Prisma.TransactionClient, "fiscalYear">) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upsertOpen(_input: UpsertOpenInput): Promise<UpsertOpenResult> {
    throw new Error("STUB — Phase 4.4 GREEN pending");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async markClosed(_input: MarkClosedInput): Promise<MarkClosedResult> {
    throw new Error("STUB — Phase 4.4 GREEN pending");
  }
}
