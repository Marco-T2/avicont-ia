import { describe, it, expect, beforeEach } from "vitest";
import { MortalityService } from "../mortality.service";
import { InMemoryMortalityRepository } from "../fakes/in-memory-mortality.repository";
import { Mortality } from "../../domain/mortality.entity";
import { MortalityCountExceedsAlive } from "../../domain/errors/mortality-errors";
import type {
  LotInquiryPort,
  LotSnapshot,
} from "../../domain/lot-inquiry.port";
import { NotFoundError } from "@/features/shared/errors";

class InMemoryLotInquiry implements LotInquiryPort {
  private readonly lots = new Map<string, LotSnapshot>();

  seed(lot: LotSnapshot): void {
    this.lots.set(lot.id, lot);
  }

  clear(): void {
    this.lots.clear();
  }

  async list(
    organizationId: string,
    filters?: { farmId?: string },
  ): Promise<LotSnapshot[]> {
    return [...this.lots.values()].filter(
      (l) =>
        l.organizationId === organizationId &&
        (!filters?.farmId || l.farmId === filters.farmId),
    );
  }

  async findById(
    organizationId: string,
    lotId: string,
  ): Promise<LotSnapshot | null> {
    const l = this.lots.get(lotId);
    return l && l.organizationId === organizationId ? l : null;
  }
}

const ORG = "org-1";

const lotSnapshot = (
  override: Partial<LotSnapshot> = {},
): LotSnapshot => ({
  id: override.id ?? "lot-1",
  name: override.name ?? "Lote 001",
  barnNumber: override.barnNumber ?? 1,
  initialCount: override.initialCount ?? 100,
  startDate: override.startDate ?? new Date("2026-01-01"),
  endDate: override.endDate ?? null,
  status: override.status ?? "ACTIVE",
  farmId: override.farmId ?? "farm-1",
  organizationId: override.organizationId ?? ORG,
  createdAt: override.createdAt ?? new Date("2026-01-01"),
  updatedAt: override.updatedAt ?? new Date("2026-01-01"),
});

const baseInput = {
  lotId: "lot-1",
  count: 10,
  date: new Date("2026-04-01"),
  createdById: "user-1",
};

describe("MortalityService.log", () => {
  let repo: InMemoryMortalityRepository;
  let lots: InMemoryLotInquiry;
  let service: MortalityService;

  beforeEach(() => {
    repo = new InMemoryMortalityRepository();
    lots = new InMemoryLotInquiry();
    lots.seed(lotSnapshot({ initialCount: 100 }));
    service = new MortalityService(repo, lots);
  });

  it("saves a mortality when count is within alive limit", async () => {
    const m = await service.log(ORG, baseInput);

    expect(m).toBeInstanceOf(Mortality);
    const persisted = await repo.findByLot(ORG, "lot-1");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.id).toBe(m.id);
  });

  it("throws NotFoundError when lot does not exist", async () => {
    lots.clear();

    await expect(service.log(ORG, baseInput)).rejects.toThrow(NotFoundError);
  });

  it("subtracts existing mortality when computing alive count", async () => {
    // alive = 100 - 95 = 5; trying to log 6 should fail
    const seed = Mortality.log({
      lotId: "lot-1",
      count: 95,
      date: new Date("2026-03-01"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 100,
    });
    repo.preload(seed);

    await expect(
      service.log(ORG, { ...baseInput, count: 6 }),
    ).rejects.toThrow(MortalityCountExceedsAlive);
  });

  it("does not save when invariant fails", async () => {
    const seed = Mortality.log({
      lotId: "lot-1",
      count: 95,
      date: new Date("2026-03-01"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 100,
    });
    repo.preload(seed);

    await expect(
      service.log(ORG, { ...baseInput, count: 100 }),
    ).rejects.toThrow();
    // only the seeded log remains; the rejected attempt did not persist
    const persisted = await repo.findByLot(ORG, "lot-1");
    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.id).toBe(seed.id);
  });
});

describe("MortalityService.getTotalByLot", () => {
  let repo: InMemoryMortalityRepository;
  let lots: InMemoryLotInquiry;
  let service: MortalityService;

  beforeEach(() => {
    repo = new InMemoryMortalityRepository();
    lots = new InMemoryLotInquiry();
    lots.seed(lotSnapshot({ initialCount: 100 }));
    service = new MortalityService(repo, lots);
  });

  it("returns sum of counts from repo.countByLot", async () => {
    repo.preload(
      Mortality.log({
        lotId: "lot-1",
        count: 12,
        date: new Date("2026-02-01"),
        createdById: "user-1",
        organizationId: ORG,
        aliveCountInLot: 100,
      }),
    );
    repo.preload(
      Mortality.log({
        lotId: "lot-1",
        count: 30,
        date: new Date("2026-03-01"),
        createdById: "user-1",
        organizationId: ORG,
        aliveCountInLot: 100,
      }),
    );

    const total = await service.getTotalByLot(ORG, "lot-1");

    expect(total).toBe(42);
  });

  it("returns 0 when no mortality logs for the lot", async () => {
    const total = await service.getTotalByLot(ORG, "lot-1");

    expect(total).toBe(0);
  });
});
