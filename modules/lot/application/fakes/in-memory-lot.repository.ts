import type { Lot } from "../../domain/lot.entity";
import type {
  LotChildCounts,
  LotRepository,
  LotWithRelationsSnapshot,
} from "../../domain/lot.repository";

/**
 * Minimal in-memory implementation of LotRepository for service tests.
 * Mirrors `modules/documents/application/fakes/` pattern.
 */
export class InMemoryLotRepository implements LotRepository {
  private readonly store = new Map<string, Lot>();
  private readonly relations = new Map<
    string,
    { expenses: { amount: number }[]; mortalityLogs: { count: number }[] }
  >();
  private readonly childCounts = new Map<string, LotChildCounts>();

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

  preloadChildCounts(lotId: string, counts: LotChildCounts): void {
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
    // D-1 bridge: keeps the legacy filter live until C4 drops the
    // method from the LotRepository interface. Reads the entity's
    // internal `_legacyFarmId` accessor (NOT part of the public
    // domain surface) so the in-memory fake mirrors the Prisma
    // adapter's row-level filter.
    return [...this.store.values()].filter(
      (l) =>
        l.organizationId === organizationId && l._legacyFarmId === farmId,
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

  /**
   * Returns the explicitly-seeded counts via preloadChildCounts. If
   * not seeded, derives from `preloadRelations` (length-based) or
   * defaults to zero. Tests stay explicit by preferring preloadChildCounts.
   */
  async findChildCounts(
    organizationId: string,
    id: string,
  ): Promise<LotChildCounts> {
    const lot = this.store.get(id);
    if (!lot || lot.organizationId !== organizationId) {
      return { expenses: 0, mortality: 0 };
    }
    const explicit = this.childCounts.get(id);
    if (explicit) return explicit;
    const rels = this.relations.get(id);
    return {
      expenses: rels?.expenses.length ?? 0,
      mortality: rels?.mortalityLogs.length ?? 0,
    };
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const lot = this.store.get(id);
    if (lot && lot.organizationId === organizationId) {
      this.store.delete(id);
      this.relations.delete(id);
      this.childCounts.delete(id);
    }
  }
}
