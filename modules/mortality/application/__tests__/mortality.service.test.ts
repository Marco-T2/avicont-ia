import { describe, it, expect, vi } from "vitest";
import { MortalityService } from "../mortality.service";
import type { MortalityRepository } from "../../domain/mortality.repository";
import type { LotInquiryPort } from "../../domain/lot-inquiry.port";
import { Mortality } from "../../domain/mortality.entity";
import { MortalityCountExceedsAlive } from "../../domain/errors/mortality-errors";
import { NotFoundError } from "@/features/shared/errors";

const fakeRepo = (overrides: Partial<MortalityRepository> = {}): MortalityRepository => ({
  findByLot: vi.fn().mockResolvedValue([]),
  countByLot: vi.fn().mockResolvedValue(0),
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const fakeLots = (initialCount = 100): LotInquiryPort => ({
  list: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue({ id: "lot-1", initialCount }),
});

const baseInput = {
  lotId: "lot-1",
  count: 10,
  date: new Date("2026-04-01"),
  createdById: "user-1",
};

describe("MortalityService.log", () => {
  it("saves a mortality when count is within alive limit", async () => {
    const repo = fakeRepo();
    const service = new MortalityService(repo, fakeLots(100));

    const m = await service.log("org-1", baseInput);

    expect(m).toBeInstanceOf(Mortality);
    expect(repo.save).toHaveBeenCalledOnce();
  });

  it("throws NotFoundError when lot does not exist", async () => {
    const lots: LotInquiryPort = {
      list: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
    };
    const service = new MortalityService(fakeRepo(), lots);

    await expect(service.log("org-1", baseInput)).rejects.toThrow(NotFoundError);
  });

  it("subtracts existing mortality when computing alive count", async () => {
    const repo = fakeRepo({ countByLot: vi.fn().mockResolvedValue(95) });
    const service = new MortalityService(repo, fakeLots(100));

    // alive = 100 - 95 = 5; trying to log 6 should fail
    await expect(
      service.log("org-1", { ...baseInput, count: 6 }),
    ).rejects.toThrow(MortalityCountExceedsAlive);
  });

  it("does not save when invariant fails", async () => {
    const repo = fakeRepo({ countByLot: vi.fn().mockResolvedValue(95) });
    const service = new MortalityService(repo, fakeLots(100));

    await expect(
      service.log("org-1", { ...baseInput, count: 100 }),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe("MortalityService.getTotalByLot", () => {
  it("delegates to repo.countByLot", async () => {
    const repo = fakeRepo({ countByLot: vi.fn().mockResolvedValue(42) });
    const service = new MortalityService(repo, fakeLots());

    const total = await service.getTotalByLot("org-1", "lot-1");

    expect(total).toBe(42);
    expect(repo.countByLot).toHaveBeenCalledWith("org-1", "lot-1");
  });
});
