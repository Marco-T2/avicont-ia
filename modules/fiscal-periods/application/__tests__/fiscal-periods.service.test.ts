import { describe, it, expect, vi } from "vitest";
import { FiscalPeriodsService } from "../fiscal-periods.service";
import type { FiscalPeriodRepository } from "../../domain/fiscal-period.repository";
import { FiscalPeriod } from "../../domain/fiscal-period.entity";
import {
  MonthAlreadyExists,
  NotMonthly,
  InvalidDateRange,
} from "../../domain/errors/fiscal-period-errors";
import { NotFoundError } from "@/features/shared/errors";

const ORG = "org-1";

const fakeRepo = (
  overrides: Partial<FiscalPeriodRepository> = {},
): FiscalPeriodRepository => ({
  findAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
  findByYearAndMonth: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const baseInput = {
  name: "Enero 2026",
  year: 2026,
  startDate: new Date(Date.UTC(2026, 0, 1)),
  endDate: new Date(Date.UTC(2026, 0, 31)),
  createdById: "user-1",
};

describe("FiscalPeriodsService.list", () => {
  it("delegates to repo.findAll", async () => {
    const period = FiscalPeriod.create({ ...baseInput, organizationId: ORG });
    const repo = fakeRepo({ findAll: vi.fn().mockResolvedValue([period]) });
    const service = new FiscalPeriodsService(repo);

    const result = await service.list(ORG);

    expect(result).toEqual([period]);
    expect(repo.findAll).toHaveBeenCalledWith(ORG);
  });
});

describe("FiscalPeriodsService.getById", () => {
  it("returns the period when found", async () => {
    const period = FiscalPeriod.create({ ...baseInput, organizationId: ORG });
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(period) });
    const service = new FiscalPeriodsService(repo);

    const result = await service.getById(ORG, "any-id");

    expect(result).toBe(period);
  });

  it("throws NotFoundError when not found", async () => {
    const service = new FiscalPeriodsService(fakeRepo());

    await expect(service.getById(ORG, "missing-id")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("FiscalPeriodsService.findByDate", () => {
  it("derives (year, month) in UTC and looks up via repo", async () => {
    const repo = fakeRepo();
    const service = new FiscalPeriodsService(repo);

    await service.findByDate(ORG, new Date(Date.UTC(2026, 3, 15)));

    expect(repo.findByYearAndMonth).toHaveBeenCalledWith(ORG, 2026, 4);
  });

  it("returns null when no period covers the date", async () => {
    const service = new FiscalPeriodsService(fakeRepo());
    const result = await service.findByDate(ORG, new Date(Date.UTC(2026, 3, 15)));
    expect(result).toBeNull();
  });

  it("returns the period when one covers the date", async () => {
    const period = FiscalPeriod.create({ ...baseInput, organizationId: ORG });
    const repo = fakeRepo({
      findByYearAndMonth: vi.fn().mockResolvedValue(period),
    });
    const service = new FiscalPeriodsService(repo);

    const result = await service.findByDate(
      ORG,
      new Date(Date.UTC(2026, 0, 15)),
    );
    expect(result).toBe(period);
  });
});

describe("FiscalPeriodsService.create", () => {
  it("rejects InvalidDateRange (delegated to entity)", async () => {
    const service = new FiscalPeriodsService(fakeRepo());

    await expect(
      service.create(ORG, {
        ...baseInput,
        startDate: new Date(Date.UTC(2026, 0, 31)),
        endDate: new Date(Date.UTC(2026, 0, 1)),
      }),
    ).rejects.toThrow(InvalidDateRange);
  });

  it("rejects NotMonthly (delegated to entity)", async () => {
    const service = new FiscalPeriodsService(fakeRepo());

    await expect(
      service.create(ORG, {
        ...baseInput,
        endDate: new Date(Date.UTC(2026, 0, 30)),
      }),
    ).rejects.toThrow(NotMonthly);
  });

  it("throws MonthAlreadyExists when pre-check finds a duplicate", async () => {
    const existing = FiscalPeriod.create({ ...baseInput, organizationId: ORG });
    const repo = fakeRepo({
      findByYearAndMonth: vi.fn().mockResolvedValue(existing),
    });
    const service = new FiscalPeriodsService(repo);

    await expect(service.create(ORG, baseInput)).rejects.toThrow(
      MonthAlreadyExists,
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("derives year+month from startDate UTC for the duplicate check", async () => {
    const repo = fakeRepo();
    const service = new FiscalPeriodsService(repo);

    await service.create(ORG, {
      ...baseInput,
      startDate: new Date(Date.UTC(2026, 5, 1)),
      endDate: new Date(Date.UTC(2026, 5, 30)),
    });

    expect(repo.findByYearAndMonth).toHaveBeenCalledWith(ORG, 2026, 6);
  });

  it("saves the period and returns it on success", async () => {
    const repo = fakeRepo();
    const service = new FiscalPeriodsService(repo);

    const result = await service.create(ORG, baseInput);

    expect(result).toBeInstanceOf(FiscalPeriod);
    expect(result.organizationId).toBe(ORG);
    expect(result.year).toBe(2026);
    expect(result.month).toBe(1);
    expect(repo.save).toHaveBeenCalledOnce();
    expect(repo.save).toHaveBeenCalledWith(result);
  });

  it("validates monthly shape BEFORE the duplicate DB lookup", async () => {
    const repo = fakeRepo();
    const service = new FiscalPeriodsService(repo);

    await expect(
      service.create(ORG, {
        ...baseInput,
        endDate: new Date(Date.UTC(2026, 0, 30)),
      }),
    ).rejects.toThrow(NotMonthly);

    expect(repo.findByYearAndMonth).not.toHaveBeenCalled();
  });
});
