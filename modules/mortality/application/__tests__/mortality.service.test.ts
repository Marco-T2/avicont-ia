import { describe, it, expect, beforeEach } from "vitest";
import { MortalityService } from "../mortality.service";
import { InMemoryMortalityRepository } from "../fakes/in-memory-mortality.repository";
import { Mortality } from "../../domain/mortality.entity";
import {
  MortalityCountExceedsAlive,
  MortalityNotFound,
} from "../../domain/errors/mortality-errors";
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
    filters?: { farmName?: string },
  ): Promise<LotSnapshot[]> {
    return [...this.lots.values()].filter(
      (l) =>
        l.organizationId === organizationId &&
        (!filters?.farmName || l.farmName === filters.farmName),
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
  farmName: override.farmName ?? "Pocona",
  memberId: override.memberId ?? "member-1",
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

describe("MortalityRepository.findById (port)", () => {
  let repo: InMemoryMortalityRepository;

  beforeEach(() => {
    repo = new InMemoryMortalityRepository();
  });

  it("returns the entity when id exists within the org", async () => {
    const seeded = Mortality.log({
      lotId: "lot-1",
      count: 5,
      date: new Date("2026-04-01"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 100,
    });
    repo.preload(seeded);

    const found = await repo.findById(ORG, seeded.id);

    expect(found).not.toBeNull();
    expect(found?.id).toBe(seeded.id);
  });

  it("returns null when id does not exist", async () => {
    const found = await repo.findById(ORG, "missing-id");

    expect(found).toBeNull();
  });
});

describe("MortalityService.update — happy path", () => {
  let repo: InMemoryMortalityRepository;
  let lots: InMemoryLotInquiry;
  let service: MortalityService;

  beforeEach(() => {
    repo = new InMemoryMortalityRepository();
    lots = new InMemoryLotInquiry();
    lots.seed(lotSnapshot({ initialCount: 100 }));
    service = new MortalityService(repo, lots);
  });

  it("updates count and persists the new entity", async () => {
    const seed = Mortality.log({
      lotId: "lot-1",
      count: 10,
      date: new Date("2026-04-01"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 100,
    });
    repo.preload(seed);

    const updated = await service.update(ORG, seed.id, { count: 7 });

    expect(updated.count.value).toBe(7);
    const persisted = await repo.findById(ORG, seed.id);
    expect(persisted?.count.value).toBe(7);
  });

  it("updates cause without touching count when count is omitted", async () => {
    const seed = Mortality.log({
      lotId: "lot-1",
      count: 10,
      date: new Date("2026-04-01"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 100,
    });
    repo.preload(seed);

    const updated = await service.update(ORG, seed.id, {
      cause: "calor",
    });

    expect(updated.count.value).toBe(10);
    expect(updated.cause).toBe("calor");
  });

  it("throws MortalityNotFound when log id does not exist", async () => {
    await expect(
      service.update(ORG, "missing-id", { count: 5 }),
    ).rejects.toThrow(MortalityNotFound);
  });
});

describe("MortalityService.update — exceeds alive guard", () => {
  let repo: InMemoryMortalityRepository;
  let lots: InMemoryLotInquiry;
  let service: MortalityService;

  beforeEach(() => {
    repo = new InMemoryMortalityRepository();
    lots = new InMemoryLotInquiry();
  });

  // Formula spec REQ-105 / design D-5:
  //   aliveCountForUpdate = lot.initialCount - (totalAllLogs - oldLogCount)
  // throws MortalityCountExceedsAlive when newCount > aliveCountForUpdate.
  it("throws MortalityCountExceedsAlive when newCount > aliveCountForUpdate", async () => {
    lots.seed(lotSnapshot({ initialCount: 100 }));
    // existing logs: 95 (this one) + 3 = 98 total. alive = 100 - 98 = 2.
    // updating THIS log from 95 → 4 means: aliveForUpdate = 100 - (98 - 95) = 97.
    // newCount=98 exceeds 97 → throws.
    const target = Mortality.log({
      lotId: "lot-1",
      count: 95,
      date: new Date("2026-03-01"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 100,
    });
    const other = Mortality.log({
      lotId: "lot-1",
      count: 3,
      date: new Date("2026-03-02"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 5,
    });
    repo.preload(target);
    repo.preload(other);
    service = new MortalityService(repo, lots);

    await expect(
      service.update(ORG, target.id, { count: 98 }),
    ).rejects.toThrow(MortalityCountExceedsAlive);
  });

  it("allows update to exactly aliveCountForUpdate (boundary)", async () => {
    lots.seed(lotSnapshot({ initialCount: 100 }));
    // target log count=20, other count=30 → total=50.
    // aliveForUpdate = 100 - (50 - 20) = 70. Update to 70 OK.
    const target = Mortality.log({
      lotId: "lot-1",
      count: 20,
      date: new Date("2026-03-01"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 100,
    });
    const other = Mortality.log({
      lotId: "lot-1",
      count: 30,
      date: new Date("2026-03-02"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 80,
    });
    repo.preload(target);
    repo.preload(other);
    service = new MortalityService(repo, lots);

    const updated = await service.update(ORG, target.id, { count: 70 });

    expect(updated.count.value).toBe(70);
  });
});

describe("MortalityService.delete", () => {
  let repo: InMemoryMortalityRepository;
  let lots: InMemoryLotInquiry;
  let service: MortalityService;

  beforeEach(() => {
    repo = new InMemoryMortalityRepository();
    lots = new InMemoryLotInquiry();
    lots.seed(lotSnapshot({ initialCount: 100 }));
    service = new MortalityService(repo, lots);
  });

  it("removes the log from the repo", async () => {
    const seed = Mortality.log({
      lotId: "lot-1",
      count: 7,
      date: new Date("2026-04-01"),
      createdById: "user-1",
      organizationId: ORG,
      aliveCountInLot: 100,
    });
    repo.preload(seed);

    await service.delete(ORG, seed.id);

    const persisted = await repo.findById(ORG, seed.id);
    expect(persisted).toBeNull();
    const remaining = await repo.findByLot(ORG, "lot-1");
    expect(remaining).toEqual([]);
  });

  it("throws MortalityNotFound when id does not exist", async () => {
    await expect(service.delete(ORG, "missing-id")).rejects.toThrow(
      MortalityNotFound,
    );
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
