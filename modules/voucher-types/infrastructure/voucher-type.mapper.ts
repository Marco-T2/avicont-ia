import type { VoucherTypeCfg } from "@/generated/prisma/client";
import { VoucherType } from "../domain/voucher-type.entity";
import { VoucherTypeCode } from "../domain/value-objects/voucher-type-code";
import { VoucherTypePrefix } from "../domain/value-objects/voucher-type-prefix";

type RowWithCount = VoucherTypeCfg & {
  _count?: { journalEntries: number };
};

export function toDomain(row: RowWithCount): VoucherType {
  return VoucherType.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    code: VoucherTypeCode.of(row.code),
    prefix: VoucherTypePrefix.of(row.prefix),
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    isAdjustment: row.isAdjustment,
    journalEntryCount: row._count?.journalEntries,
  });
}

export function toPersistence(entity: VoucherType) {
  return {
    id: entity.id,
    organizationId: entity.organizationId,
    code: entity.code,
    prefix: entity.prefix,
    name: entity.name,
    description: entity.description,
    isActive: entity.isActive,
    isAdjustment: entity.isAdjustment,
  };
}
