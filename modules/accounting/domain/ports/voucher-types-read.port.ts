/**
 * Read-only port for voucher types. Non-tx — voucher type existence is checked
 * before the UoW tx opens (parity with legacy `voucherTypesService.getById`).
 * The adapter MUST throw NotFoundError when the voucher type does not belong
 * to the organization.
 *
 * The use case only needs to verify existence (legacy behaviour: `getById`
 * throws if not found). No fields beyond `id` are consumed today, so the
 * return type is intentionally minimal.
 */
export interface AccountingVoucherType {
  id: string;
}

export interface VoucherTypesReadPort {
  getById(
    organizationId: string,
    voucherTypeId: string,
  ): Promise<AccountingVoucherType>;
}
