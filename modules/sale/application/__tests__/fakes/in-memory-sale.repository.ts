import type { Sale } from "../../../domain/sale.entity";
import type {
  SaleFilters,
  SaleRepository,
} from "../../../domain/ports/sale.repository";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";

/**
 * In-memory `SaleRepository` fake. Read methods (`findById`, `findAll`,
 * `findPaginated`) are implemented; tx-aware writes throw "not implemented"
 * until the use cases that need them land in Ciclos 4-7 (strict TDD per-test,
 * no speculative scaffolding — parity with POC #10 fakes). `findPaginated` is
 * the NEW dual-method paralelo (POC pagination-sale C1-MACRO Opción C
 * ADDITIVE — paralelo a findAll legacy preserved).
 */
export class InMemorySaleRepository implements SaleRepository {
  private readonly store = new Map<string, Sale>();

  reset(): void {
    this.store.clear();
  }

  preload(...sales: Sale[]): void {
    for (const s of sales) this.store.set(s.id, s);
  }

  async findById(organizationId: string, id: string): Promise<Sale | null> {
    const sale = this.store.get(id);
    if (!sale) return null;
    return sale.organizationId === organizationId ? sale : null;
  }

  async findAll(
    organizationId: string,
    filters?: SaleFilters,
  ): Promise<Sale[]> {
    return [...this.store.values()].filter((sale) => {
      if (sale.organizationId !== organizationId) return false;
      if (filters?.contactId && sale.contactId !== filters.contactId) return false;
      if (filters?.status && sale.status !== filters.status) return false;
      if (filters?.dateFrom && sale.date < filters.dateFrom) return false;
      if (filters?.dateTo && sale.date > filters.dateTo) return false;
      return true;
    });
  }

  async findPaginated(
    organizationId: string,
    filters?: SaleFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Sale>> {
    const all = await this.findAll(organizationId, filters);
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const total = all.length;
    const items = all.slice((page - 1) * pageSize, page * pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, total, page, pageSize, totalPages };
  }

  saveTxCalls: Sale[] = [];

  async findByIdTx(organizationId: string, id: string): Promise<Sale | null> {
    return this.findById(organizationId, id);
  }

  async saveTx(sale: Sale): Promise<Sale> {
    this.saveTxCalls.push(sale);
    this.store.set(sale.id, sale);
    return sale;
  }

  updateTxCalls: { sale: Sale; options: { replaceDetails: boolean } }[] = [];

  async updateTx(
    sale: Sale,
    options: { replaceDetails: boolean },
  ): Promise<Sale> {
    this.updateTxCalls.push({ sale, options });
    this.store.set(sale.id, sale);
    return sale;
  }

  deleteTxCalls: { organizationId: string; id: string }[] = [];

  async deleteTx(organizationId: string, id: string): Promise<void> {
    this.deleteTxCalls.push({ organizationId, id });
    this.store.delete(id);
  }

  private nextSequenceByOrg = new Map<string, number>();

  async getNextSequenceNumberTx(organizationId: string): Promise<number> {
    const next = (this.nextSequenceByOrg.get(organizationId) ?? 0) + 1;
    this.nextSequenceByOrg.set(organizationId, next);
    return next;
  }
}
