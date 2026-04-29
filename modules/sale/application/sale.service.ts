import { NotFoundError } from "@/features/shared/errors";
import type { Sale } from "../domain/sale.entity";
import type {
  SaleFilters,
  SaleRepository,
} from "../domain/ports/sale.repository";

export class SaleService {
  constructor(private readonly repo: SaleRepository) {}

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
}
