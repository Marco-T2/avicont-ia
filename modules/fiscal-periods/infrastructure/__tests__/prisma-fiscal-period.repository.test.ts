import { describe, it, expect, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PrismaFiscalPeriodRepository } from "../prisma-fiscal-period.repository";
import { FiscalPeriod } from "../../domain/fiscal-period.entity";
import { MonthAlreadyExists } from "../../domain/errors/fiscal-period-errors";

const buildPeriod = () =>
  FiscalPeriod.create({
    organizationId: "org-1",
    name: "Febrero 2026",
    year: 2026,
    startDate: new Date(Date.UTC(2026, 1, 1)),
    endDate: new Date(Date.UTC(2026, 1, 28)),
    createdById: "user-1",
  });

const dbWith = (createImpl: ReturnType<typeof vi.fn>): PrismaClient =>
  ({
    fiscalPeriod: { create: createImpl },
  }) as unknown as PrismaClient;

// TRIP-WIRE: the literal "fiscal_periods_organizationId_year_month_key" MUST
// appear identically here and in prisma-fiscal-period.repository.ts. Any Prisma
// rename fails BOTH visibly. Mirrors the legacy multiplicity test contract.
describe("PrismaFiscalPeriodRepository.save — P2002 trip-wire", () => {
  it("translates P2002 on the unique month index to MonthAlreadyExists", async () => {
    const period = buildPeriod();
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: {
          target: ["fiscal_periods_organizationId_year_month_key"],
        },
      },
    );
    const repo = new PrismaFiscalPeriodRepository(
      dbWith(vi.fn().mockRejectedValueOnce(p2002)),
    );

    await expect(repo.save(period)).rejects.toThrow(MonthAlreadyExists);
  });

  it("re-throws non-P2002 Prisma errors unchanged", async () => {
    const period = buildPeriod();
    const generic = new Error("DB exploded");
    const repo = new PrismaFiscalPeriodRepository(
      dbWith(vi.fn().mockRejectedValueOnce(generic)),
    );

    await expect(repo.save(period)).rejects.toThrow("DB exploded");
  });

  it("re-throws P2002 on a different index (trip-wire is index-specific)", async () => {
    const period = buildPeriod();
    const p2002OtherIndex = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["some_other_unique_index"] },
      },
    );
    const repo = new PrismaFiscalPeriodRepository(
      dbWith(vi.fn().mockRejectedValueOnce(p2002OtherIndex)),
    );

    let caught: unknown;
    try {
      await repo.save(period);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(caught).not.toBeInstanceOf(MonthAlreadyExists);
  });

  it("does NOT swallow successful create (sanity)", async () => {
    const period = buildPeriod();
    const create = vi.fn().mockResolvedValue({});
    const repo = new PrismaFiscalPeriodRepository(dbWith(create));

    await expect(repo.save(period)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledOnce();
  });
});
