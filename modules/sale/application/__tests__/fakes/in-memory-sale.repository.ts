import type { Sale } from "../../../domain/sale.entity";
import type {
  SaleFilters,
  SaleRepository,
} from "../../../domain/ports/sale.repository";

/**
 * In-memory `SaleRepository` fake. Read methods (`findById`, `findAll`) are
 * implemented for Ciclo 2; tx-aware writes throw "not implemented" until the
 * use cases that need them land in Ciclos 4-7 (strict TDD per-test, no
 * speculative scaffolding — parity with POC #10 fakes).
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
