import { describe, it, expect, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PrismaVoucherTypeRepository } from "../prisma-voucher-type.repository";
import { VoucherType } from "../../domain/voucher-type.entity";
import { VoucherTypeCodeDuplicate } from "../../domain/errors/voucher-type-errors";

const buildEntity = () =>
  VoucherType.create({
    organizationId: "org-1",
    code: "CI",
    prefix: "I",
    name: "Ingreso",
  });

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({
    voucherTypeCfg: overrides,
  }) as unknown as PrismaClient;

// TRIP-WIRE: the literal "voucher_types_organizationId_code_key" MUST appear
// identically in prisma-voucher-type.repository.ts and here. Any Prisma rename
// fails BOTH visibly. Mirrors the fiscal-periods unique-index trip-wire pattern.
describe("PrismaVoucherTypeRepository.save — P2002 trip-wire", () => {
  it("translates P2002 on the unique code index to VoucherTypeCodeDuplicate", async () => {
    const entity = buildEntity();
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: {
          target: ["voucher_types_organizationId_code_key"],
        },
      },
    );
    const repo = new PrismaVoucherTypeRepository(
      dbWith({ create: vi.fn().mockRejectedValueOnce(p2002) }),
    );

    await expect(repo.save(entity)).rejects.toThrow(VoucherTypeCodeDuplicate);
  });

  it("re-throws non-P2002 errors unchanged", async () => {
    const entity = buildEntity();
    const generic = new Error("DB exploded");
    const repo = new PrismaVoucherTypeRepository(
      dbWith({ create: vi.fn().mockRejectedValueOnce(generic) }),
    );

    await expect(repo.save(entity)).rejects.toThrow("DB exploded");
  });

  it("re-throws P2002 on a different index (trip-wire is index-specific)", async () => {
    const entity = buildEntity();
    const p2002OtherIndex = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "test",
        meta: { target: ["some_other_unique_index"] },
      },
    );
    const repo = new PrismaVoucherTypeRepository(
      dbWith({ create: vi.fn().mockRejectedValueOnce(p2002OtherIndex) }),
    );

    let caught: unknown;
    try {
      await repo.save(entity);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    expect(caught).not.toBeInstanceOf(VoucherTypeCodeDuplicate);
  });

  it("does NOT swallow successful create (sanity)", async () => {
    const entity = buildEntity();
    const create = vi.fn().mockResolvedValue({});
    const repo = new PrismaVoucherTypeRepository(dbWith({ create }));

    await expect(repo.save(entity)).resolves.toBeUndefined();
    expect(create).toHaveBeenCalledOnce();
  });
});

describe("PrismaVoucherTypeRepository.findAll", () => {
  it("passes isActive filter through to where clause", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaVoucherTypeRepository(dbWith({ findMany }));

    await repo.findAll("org-1", { isActive: true });

    const arg = findMany.mock.calls[0]![0];
    expect(arg.where).toEqual({ organizationId: "org-1", isActive: true });
  });

  it("includes _count.journalEntries when includeCounts=true", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaVoucherTypeRepository(dbWith({ findMany }));

    await repo.findAll("org-1", { includeCounts: true });

    const arg = findMany.mock.calls[0]![0];
    expect(arg.include).toEqual({
      _count: { select: { journalEntries: true } },
    });
  });

  it("orders by code ascending", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaVoucherTypeRepository(dbWith({ findMany }));

    await repo.findAll("org-1");

    expect(findMany.mock.calls[0]![0].orderBy).toEqual({ code: "asc" });
  });
});

describe("PrismaVoucherTypeRepository.update", () => {
  it("scopes update by id + organizationId and writes editable fields", async () => {
    const update = vi.fn().mockResolvedValue({});
    const repo = new PrismaVoucherTypeRepository(dbWith({ update }));
    const entity = buildEntity().rename("Nuevo").changePrefix("X");

    await repo.update(entity);

    const arg = update.mock.calls[0]![0];
    expect(arg.where).toEqual({ id: entity.id, organizationId: "org-1" });
    expect(arg.data).toMatchObject({
      name: "Nuevo",
      prefix: "X",
      isActive: true,
    });
    expect(arg.data).not.toHaveProperty("code");
  });
});

describe("PrismaVoucherTypeRepository.saveMany", () => {
  it("upserts each entity by [organizationId, code] (idempotent seed)", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const repo = new PrismaVoucherTypeRepository(dbWith({ upsert }));
    const e1 = buildEntity();
    const e2 = VoucherType.create({
      organizationId: "org-1",
      code: "CJ",
      prefix: "J",
      name: "Ajuste",
      isAdjustment: true,
    });

    await repo.saveMany([e1, e2]);

    expect(upsert).toHaveBeenCalledTimes(2);
    const firstArg = upsert.mock.calls[0]![0];
    expect(firstArg.where).toEqual({
      organizationId_code: { organizationId: "org-1", code: "CI" },
    });
    expect(firstArg.update).toEqual({});
    expect(firstArg.create).toMatchObject({ code: "CI", prefix: "I" });
  });
});

describe("PrismaVoucherTypeRepository.withTransaction", () => {
  it("returns a new adapter bound to the given tx client", async () => {
    const txUpsert = vi.fn().mockResolvedValue({});
    const tx = { voucherTypeCfg: { upsert: txUpsert } } as unknown as Prisma.TransactionClient;
    const repo = new PrismaVoucherTypeRepository(
      dbWith({ upsert: vi.fn() }),
    );
    const txRepo = repo.withTransaction(tx);

    await txRepo.saveMany([buildEntity()]);

    expect(txUpsert).toHaveBeenCalledOnce();
  });
});
