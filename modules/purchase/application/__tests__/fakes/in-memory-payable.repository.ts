import type { Payable } from "@/modules/payables/domain/payable.entity";
import type {
  AllocationLifoSnapshot,
  PayableRepository,
  PayableTrimItem,
} from "@/modules/payables/domain/payable.repository";

/**
 * In-memory `PayableRepository` fake para purchase-hex application tests.
 * Espejo simétrico a `InMemoryReceivableRepository` (sale-hex). Implementa
 * sólo los métodos que purchase-hex use cases consumen — los tx-aware
 * writes throw "not implemented" hasta que los use cases que los necesitan
 * landeen en C5+ (paridad strict TDD per-test).
 */
export class InMemoryPayableRepository implements PayableRepository {
  private readonly payables = new Map<string, Payable>();
  private readonly allocationsByPayable = new Map<
    string,
    AllocationLifoSnapshot[]
  >();

  reset(): void {
    this.payables.clear();
    this.allocationsByPayable.clear();
  }

  preloadPayable(...payables: Payable[]): void {
    for (const p of payables) this.payables.set(p.id, p);
  }

  /**
   * Test setter — allocations pre-ordered LIFO por el caller (el adapter
   * real lo hace via `orderBy: { id: "desc" }`).
   */
  preloadAllocations(payableId: string, snapshots: AllocationLifoSnapshot[]) {
    this.allocationsByPayable.set(payableId, snapshots);
  }

  async findById(organizationId: string, id: string): Promise<Payable | null> {
    const p = this.payables.get(id);
    return p && p.organizationId === organizationId ? p : null;
  }

  async findAllocationsForPayable(
    _organizationId: string,
    payableId: string,
  ): Promise<AllocationLifoSnapshot[]> {
    return this.allocationsByPayable.get(payableId) ?? [];
  }

  applyTrimPlanCalls: {
    organizationId: string;
    payableId: string;
    items: PayableTrimItem[];
  }[] = [];

  async applyTrimPlanTx(
    _tx: unknown,
    organizationId: string,
    payableId: string,
    items: PayableTrimItem[],
  ): Promise<void> {
    this.applyTrimPlanCalls.push({ organizationId, payableId, items });
    const current = this.allocationsByPayable.get(payableId) ?? [];
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
    this.allocationsByPayable.set(payableId, filtered);
  }

  async findAll(): Promise<Payable[]> {
    throw new Error(
      "InMemoryPayableRepository.findAll not implemented (purchase-hex does not consume)",
    );
  }
  async save(): Promise<void> {
    throw new Error("InMemoryPayableRepository.save not implemented");
  }

  updateCalls: Payable[] = [];

  async update(payable: Payable): Promise<void> {
    this.updateCalls.push(payable);
    this.payables.set(payable.id, payable);
  }
  async aggregateOpen(): Promise<{ totalBalance: number; count: number }> {
    throw new Error("InMemoryPayableRepository.aggregateOpen not implemented");
  }
  async findPendingByContact(): Promise<never> {
    throw new Error(
      "InMemoryPayableRepository.findPendingByContact not implemented",
    );
  }
  async createTx(): Promise<{ id: string }> {
    throw new Error(
      "InMemoryPayableRepository.createTx not implemented (purchase-hex Ciclos 4+ use real UoW fakes)",
    );
  }
  async voidTx(): Promise<void> {
    throw new Error("InMemoryPayableRepository.voidTx not implemented");
  }
  async findByIdTx(): Promise<Payable | null> {
    throw new Error("InMemoryPayableRepository.findByIdTx not implemented");
  }
  async applyAllocationTx(): Promise<void> {
    throw new Error(
      "InMemoryPayableRepository.applyAllocationTx not implemented",
    );
  }
  async revertAllocationTx(): Promise<void> {
    throw new Error(
      "InMemoryPayableRepository.revertAllocationTx not implemented",
    );
  }
}
