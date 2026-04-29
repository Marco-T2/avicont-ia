import { VoucherTypesService } from "@/features/voucher-types/server";
import type {
  AccountingVoucherType,
  VoucherTypesReadPort,
} from "@/modules/accounting/domain/ports/voucher-types-read.port";

const legacy = new VoucherTypesService();

/**
 * Cross-module narrow map (8→1 field) sobre `VoucherTypesService.getById`.
 * Throw legacy `NotFoundError("Tipo de comprobante")` se propaga sin re-wrap.
 */
export class VoucherTypesReadAdapter implements VoucherTypesReadPort {
  async getById(
    organizationId: string,
    voucherTypeId: string,
  ): Promise<AccountingVoucherType> {
    const voucherType = await legacy.getById(organizationId, voucherTypeId);
    return { id: voucherType.id };
  }
}
