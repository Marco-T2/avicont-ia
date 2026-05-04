import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { VoucherTypesService } from "../application/voucher-types.service";
import { PrismaVoucherTypeRepository } from "../infrastructure/prisma-voucher-type.repository";
import type { VoucherTypeRepository } from "../domain/voucher-type.repository";

export function makeVoucherTypesService(): VoucherTypesService {
  return new VoucherTypesService(new PrismaVoucherTypeRepository());
}

export function makeVoucherTypesServiceForTx(
  tx: Prisma.TransactionClient,
): VoucherTypesService {
  return new VoucherTypesService(
    new PrismaVoucherTypeRepository().withTransaction(tx),
  );
}

export function makeVoucherTypeRepository(): VoucherTypeRepository {
  return new PrismaVoucherTypeRepository();
}
