import { NotFoundError } from "@/features/shared/errors";
import type { ReceivableRepository } from "@/modules/receivables/domain/receivable.repository";
import type { Sale } from "../domain/sale.entity";
import type {
  SaleFilters,
  SaleRepository,
} from "../domain/ports/sale.repository";
import {
  computeTrimPlan,
  type TrimPreviewItem,
} from "../domain/compute-trim-plan";

export interface EditPreview {
  trimPreview: TrimPreviewItem[];
}

export class SaleService {
  constructor(
    private readonly repo: SaleRepository,
    private readonly receivables?: ReceivableRepository,
  ) {}

  async list(
    organizationId: string,
    filters?: SaleFilters,
  ): Promise<Sale[]> {
    return this.repo.findAll(organizationId, filters);
  }

  async getById(organizationId: string, id: string): Promise<Sale> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Venta");
    return found;
  }

  /**
   * Simulates the LIFO trim plan for an `editPosted` operation that would
   * lower the sale's total to `newTotal`. Read-only — no DB writes. Mirrors
   * legacy `sale.service.ts:525-560` (fidelidad regla #1).
   */
  async getEditPreview(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<EditPreview> {
    if (!this.receivables) {
      throw new Error(
        "SaleService.getEditPreview requires ReceivableRepository — inject in constructor",
      );
    }

    const sale = await this.getById(organizationId, saleId);
    if (!sale.receivableId) {
      return { trimPreview: [] };
    }

    const receivable = await this.receivables.findById(
      organizationId,
      sale.receivableId,
    );
    const rawPaid = receivable ? Number(receivable.paid.value) : 0;

    if (newTotal >= rawPaid) {
      return { trimPreview: [] };
    }

    const allocations = await this.receivables.findAllocationsForReceivable(
      organizationId,
      sale.receivableId,
    );

    return { trimPreview: computeTrimPlan(allocations, rawPaid - newTotal) };
  }
}
