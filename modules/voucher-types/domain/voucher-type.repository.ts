import type { VoucherType } from "./voucher-type.entity";

export interface ListVoucherTypesOptions {
  isActive?: boolean;
  includeCounts?: boolean;
}

export interface VoucherTypeRepository {
  findAll(
    organizationId: string,
    options?: ListVoucherTypesOptions,
  ): Promise<VoucherType[]>;
  findById(organizationId: string, id: string): Promise<VoucherType | null>;
  findByCode(organizationId: string, code: string): Promise<VoucherType | null>;
  save(voucherType: VoucherType): Promise<void>;
  update(voucherType: VoucherType): Promise<void>;
  saveMany(voucherTypes: VoucherType[]): Promise<void>;
}
