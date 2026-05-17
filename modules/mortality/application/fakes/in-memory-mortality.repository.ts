import type { Mortality } from "../../domain/mortality.entity";
import type { MortalityRepository } from "../../domain/mortality.repository";

/**
 * Minimal in-memory implementation of MortalityRepository for service tests.
 * Mirrors `modules/documents/application/fakes/` pattern and the freshly
 * extracted lot/expense fakes (T2, T3). Establishes paridad and replaces
 * the vi.fn() inline pattern that has historically lived in
 * mortality.service.test.ts.
 *
 * Methods declared by the current port (findByLot, countByLot, save) are
 * fully implemented. `findById`, `update`, `delete` will land in Fases 2–4
 * once the port itself is extended.
 */
export class InMemoryMortalityRepository implements MortalityRepository {
  private readonly store = new Map<string, Mortality>();

  reset(): void {
    this.store.clear();
  }

  /** Test helper: seed an entity without going through `save` semantics. */
  preload(m: Mortality): void {
    this.store.set(m.id, m);
  }

  async findByLot(
    organizationId: string,
    lotId: string,
  ): Promise<Mortality[]> {
    return [...this.store.values()].filter(
      (m) => m.organizationId === organizationId && m.lotId === lotId,
    );
  }

  /** Returns SUM of counts (not record count) — matches Prisma adapter. */
  async countByLot(
    organizationId: string,
    lotId: string,
  ): Promise<number> {
    return [...this.store.values()]
      .filter(
        (m) => m.organizationId === organizationId && m.lotId === lotId,
      )
      .reduce((sum, m) => sum + m.count.value, 0);
  }

  async save(mortality: Mortality): Promise<void> {
    this.store.set(mortality.id, mortality);
  }
}
