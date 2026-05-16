import type { Prisma } from "@/generated/prisma/client";

import type {
  CreateTwelvePeriodsInput,
  CreateTwelvePeriodsResult,
  PeriodAutoCreatorTxPort,
} from "../domain/ports/period-auto-creator-tx.port";

/**
 * Phase 4.11 STUB — bulk period creator scaffolding for tsc.
 */
export class PrismaPeriodAutoCreatorTxAdapter
  implements PeriodAutoCreatorTxPort
{
  constructor(private readonly tx: Pick<Prisma.TransactionClient, "fiscalPeriod">) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createTwelvePeriodsForYear(_input: CreateTwelvePeriodsInput): Promise<CreateTwelvePeriodsResult> {
    throw new Error("STUB — Phase 4.12 GREEN pending");
  }
}
