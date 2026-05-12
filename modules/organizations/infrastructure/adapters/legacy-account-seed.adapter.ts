import "server-only";
import { AccountsService } from "@/features/accounting/accounts.service";
import type { Prisma } from "@/generated/prisma/client";
import type { AccountSeedPort } from "../../domain/ports/account-seed.port";

/**
 * Legacy adapter: wraps features/accounting AccountsService.seedChartOfAccounts.
 */
export class LegacyAccountSeedAdapter implements AccountSeedPort {
  private readonly service: AccountsService;

  constructor() {
    this.service = new AccountsService();
  }

  async seedChartOfAccounts(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.service.seedChartOfAccounts(organizationId, tx);
  }
}
