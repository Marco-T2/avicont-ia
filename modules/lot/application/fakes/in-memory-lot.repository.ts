import type { Lot } from "../../domain/lot.entity";
import type {
  LotRepository,
  LotWithRelationsSnapshot,
} from "../../domain/lot.repository";

/**
 * Minimal in-memory implementation of LotRepository for service tests.
 * Mirrors `modules/documents/application/fakes/` pattern.
 * Stubs `delete` + `findChildCounts` until those features land (T25-T27).
 */
export class InMemoryLotRepository implements LotRepository {
  private readonly store = new Map<string, Lot>();
  private readonly relations = new Map<
    string,
    { expenses: { amount: number }[]; mortalityLogs: { count: number }[] }
  >();
  // Stub-only counters: tests for delete (T26+) set these explicitly.
  private readonly childCounts = new Map<
    string,
    { expenses: number; mortality: number }
  >();

  reset(): void {
    this.store.clear();
    this.relations.clear();
    this.childCounts.clear();
  }

  preloadRelations(
    lotId: string,
    relations: {
      expenses: { amount: number }[];
      mortalityLogs: { count: number }[];
    },
  ): void {
    this.relations.set(lotId, relations);
  }

  preloadChildCounts(
    lotId: string,
    counts: { expenses: number; mortality: number },
  ): void {
    this.childCounts.set(lotId, counts);
  }

  async findAll(organizationId: string): Promise<Lot[]> {
    return [...this.store.values()].filter(
      (l) => l.organizationId === organizationId,
    );
  }

  async findById(organizationId: string, id: string): Promise<Lot | null> {
    const l = this.store.get(id);
    return l && l.organizationId === organizationId ? l : null;
  }

  async findByFarm(
    organizationId: string,
    farmId: string,
  ): Promise<Lot[]> {
    return [...this.store.values()].filter(
      (l) => l.organizationId === organizationId && l.farmId === farmId,
    );
  }

  async findByIdWithRelations(
    organizationId: string,
    id: string,
  ): Promise<LotWithRelationsSnapshot | null> {
    const l = this.store.get(id);
    if (!l || l.organizationId !== organizationId) return null;
    const rels = this.relations.get(id) ?? {
      expenses: [],
      mortalityLogs: [],
    };
    return {
      lot: l,
      expenses: rels.expenses,
      mortalityLogs: rels.mortalityLogs,
    };
  }

  async save(lot: Lot): Promise<void> {
    this.store.set(lot.id, lot);
  }

  async update(lot: Lot): Promise<void> {
    this.store.set(lot.id, lot);
  }
}
