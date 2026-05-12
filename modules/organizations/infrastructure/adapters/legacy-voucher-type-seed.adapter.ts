import "server-only";
import { VoucherTypesService, makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import type { Prisma } from "@/generated/prisma/client";
import type { VoucherTypeSeedPort } from "../../domain/ports/voucher-type-seed.port";

/**
 * Legacy adapter: wraps modules/voucher-types VoucherTypesService.seedDefaultsForOrg.
 */
export class LegacyVoucherTypeSeedAdapter implements VoucherTypeSeedPort {
  private readonly service: VoucherTypesService;

  constructor() {
    this.service = makeVoucherTypesService();
  }

  async seedDefaultsForOrg(
    organizationId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.service.seedDefaultsForOrg(organizationId, tx);
  }
}
