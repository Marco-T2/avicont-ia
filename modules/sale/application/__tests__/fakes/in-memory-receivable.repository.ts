import type { Receivable } from "@/modules/receivables/domain/receivable.entity";
import type {
  AllocationLifoSnapshot,
  ReceivableRepository,
  ReceivableTrimItem,
} from "@/modules/receivables/domain/receivable.repository";

/**
 * In-memory `ReceivableRepository` fake for sale-hex application tests.
 * Implements only the read methods sale-hex use cases consume in Ciclos 3+.
 * Write/tx-aware methods throw "not implemented" — sale-hex never invokes
 * them via this fake (those use cases will use the real Prisma adapter
 * during integration tests in A3).
 */
export class InMemoryReceivableRepository implements ReceivableRepository {
  private readonly receivables = new Map<string, Receivable>();
  private readonly allocationsByReceivable = new Map<
    string,
    AllocationLifoSnapshot[]
  >();

  reset(): void {
    this.receivables.clear();
    this.allocationsByReceivable.clear();
  }

  preloadReceivable(...receivables: Receivable[]): void {
    for (const r of receivables) this.receivables.set(r.id, r);
  }

  /**
   * Test setter — allocations are pre-ordered LIFO by the caller (the real
   * adapter does it via `orderBy: { id: "desc" }`).
   */
  preloadAllocations(receivableId: string, snapshots: AllocationLifoSnapshot[]) {
    this.allocationsByReceivable.set(receivableId, snapshots);
  }

  async findById(organizationId: string, id: string): Promise<Receivable | null> {
    const r = this.receivables.get(id);
    return r && r.organizationId === organizationId ? r : null;
  }

  async findAllocationsForReceivable(
    _organizationId: string,
    receivableId: string,
  ): Promise<AllocationLifoSnapshot[]> {
    return this.allocationsByReceivable.get(receivableId) ?? [];
  }

  applyTrimPlanCalls: {
    organizationId: string;
    receivableId: string;
    items: ReceivableTrimItem[];
  }[] = [];

  async applyTrimPlanTx(
    _tx: unknown,
    organizationId: string,
    receivableId: string,
    items: ReceivableTrimItem[],
  ): Promise<void> {
    this.applyTrimPlanCalls.push({ organizationId, receivableId, items });
    const current = this.allocationsByReceivable.get(receivableId) ?? [];
    const itemMap = new Map(items.map((i) => [i.allocationId, i.newAmount]));
    const filtered: AllocationLifoSnapshot[] = [];
    for (const a of current) {
      if (!itemMap.has(a.id)) {
        filtered.push(a);
        continue;
      }
      const newAmt = itemMap.get(a.id)!;
      if (newAmt > 0) filtered.push({ ...a, amount: newAmt });
    }
    this.allocationsByReceivable.set(receivableId, filtered);
  }

  async findAll(): Promise<Receivable[]> {
    throw new Error("InMemoryReceivableRepository.findAll not implemented (sale-hex does not consume)");
  }
  async save(): Promise<void> {
    throw new Error("InMemoryReceivableRepository.save not implemented");
  }

  updateCalls: Receivable[] = [];

  async update(receivable: Receivable): Promise<void> {
    this.updateCalls.push(receivable);
    this.receivables.set(receivable.id, receivable);
  }
  async aggregateOpen(): Promise<{ totalBalance: number; count: number }> {
    throw new Error("InMemoryReceivableRepository.aggregateOpen not implemented");
  }
  async findPendingByContact(): Promise<never> {
    throw new Error("InMemoryReceivableRepository.findPendingByContact not implemented");
  }
  async createTx(): Promise<{ id: string }> {
    throw new Error("InMemoryReceivableRepository.createTx not implemented (sale-hex Ciclos 4+ use real UoW fakes)");
  }
  async voidTx(): Promise<void> {
    throw new Error("InMemoryReceivableRepository.voidTx not implemented");
  }
  async findByIdTx(): Promise<Receivable | null> {
    throw new Error("InMemoryReceivableRepository.findByIdTx not implemented");
  }
  async applyAllocationTx(): Promise<void> {
    throw new Error("InMemoryReceivableRepository.applyAllocationTx not implemented");
  }
  async revertAllocationTx(): Promise<void> {
    throw new Error("InMemoryReceivableRepository.revertAllocationTx not implemented");
  }
}
