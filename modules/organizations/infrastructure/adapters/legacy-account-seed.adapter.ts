import "server-only";
import {
  makeAccountsService,
  type AccountsService,
} from "@/modules/accounting/presentation/server";
import type { Prisma } from "@/generated/prisma/client";
import type { AccountSeedPort } from "../../domain/ports/account-seed.port";

/**
 * Legacy adapter: wraps hex AccountsService.seedChartOfAccounts (POC #3e cutover).
 */
export class LegacyAccountSeedAdapter implements AccountSeedPort {
  private readonly service: AccountsService;

  constructor() {
    this.service = makeAccountsService();
  }

  async seedChartOfAccounts(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.service.seedChartOfAccounts(organizationId, tx);
  }
}
