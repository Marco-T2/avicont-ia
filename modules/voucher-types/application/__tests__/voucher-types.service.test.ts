import { describe, it, expect, vi } from "vitest";
import { VoucherTypesService } from "../voucher-types.service";
import type { VoucherTypeRepository } from "../../domain/voucher-type.repository";
import { VoucherType } from "../../domain/voucher-type.entity";
import {
  VoucherTypeCodeDuplicate,
  VoucherTypeNotInOrg,
} from "../../domain/errors/voucher-type-errors";
import { NotFoundError } from "@/features/shared/errors";

const ORG = "org-1";

const fakeRepo = (
  overrides: Partial<VoucherTypeRepository> = {},
): VoucherTypeRepository => ({
  findAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn().mockResolvedValue(null),
  findByCode: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  saveMany: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

const baseEntity = () =>
  VoucherType.create({
    organizationId: ORG,
    code: "CI",
    prefix: "I",
    name: "Ingreso",
  });

describe("VoucherTypesService.list", () => {
  it("delegates to repo.findAll with options", async () => {
    const repo = fakeRepo();
    const service = new VoucherTypesService(repo);
    await service.list(ORG, { isActive: true });
    expect(repo.findAll).toHaveBeenCalledWith(ORG, { isActive: true });
  });

  it("delegates to repo.findAll without options", async () => {
    const repo = fakeRepo();
    const service = new VoucherTypesService(repo);
    await service.list(ORG);
    expect(repo.findAll).toHaveBeenCalledWith(ORG, undefined);
  });
});

describe("VoucherTypesService.getById", () => {
  it("returns entity when found", async () => {
    const entity = baseEntity();
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const result = await new VoucherTypesService(repo).getById(ORG, entity.id);
    expect(result).toBe(entity);
  });

  it("throws NotFoundError when missing", async () => {
    const service = new VoucherTypesService(fakeRepo());
    await expect(service.getById(ORG, "missing")).rejects.toThrow(NotFoundError);
  });
});

describe("VoucherTypesService.getByCode", () => {
  it("returns entity when found", async () => {
    const entity = baseEntity();
    const repo = fakeRepo({ findByCode: vi.fn().mockResolvedValue(entity) });
    const result = await new VoucherTypesService(repo).getByCode(ORG, "CI");
    expect(result).toBe(entity);
  });

  it("throws VoucherTypeNotInOrg when code unknown", async () => {
    const service = new VoucherTypesService(fakeRepo());
    await expect(service.getByCode(ORG, "ZZ")).rejects.toThrow(VoucherTypeNotInOrg);
  });
});

describe("VoucherTypesService.create", () => {
  it("rejects duplicate code in same org with VoucherTypeCodeDuplicate", async () => {
    const existing = baseEntity();
    const repo = fakeRepo({ findByCode: vi.fn().mockResolvedValue(existing) });
    const service = new VoucherTypesService(repo);

    await expect(
      service.create(ORG, { code: "CI", prefix: "I", name: "X" }),
    ).rejects.toThrow(VoucherTypeCodeDuplicate);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("allows same code in different orgs (per-org uniqueness)", async () => {
    const repo = fakeRepo();
    const service = new VoucherTypesService(repo);

    const result = await service.create("org-B", {
      code: "CI",
      prefix: "I",
      name: "Ingreso",
    });

    expect(result.organizationId).toBe("org-B");
    expect(repo.findByCode).toHaveBeenCalledWith("org-B", "CI");
    expect(repo.save).toHaveBeenCalledWith(result);
  });

  it("persists a valid creation through repo.save", async () => {
    const repo = fakeRepo();
    const service = new VoucherTypesService(repo);
    const result = await service.create(ORG, {
      code: "CX",
      prefix: "X",
      name: "Custom",
      description: "Una descripción",
    });

    expect(result.code).toBe("CX");
    expect(result.prefix).toBe("X");
    expect(result.description).toBe("Una descripción");
    expect(repo.save).toHaveBeenCalledOnce();
  });
});

describe("VoucherTypesService.update", () => {
  it("throws NotFoundError when entity missing", async () => {
    const service = new VoucherTypesService(fakeRepo());
    await expect(
      service.update(ORG, "missing", { name: "X" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("renames the entity", async () => {
    const entity = baseEntity();
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const service = new VoucherTypesService(repo);

    const result = await service.update(ORG, entity.id, { name: "Nuevo" });

    expect(result.name).toBe("Nuevo");
    expect(repo.update).toHaveBeenCalledWith(result);
  });

  it("changes the prefix", async () => {
    const entity = baseEntity();
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const result = await new VoucherTypesService(repo).update(ORG, entity.id, {
      prefix: "X",
    });
    expect(result.prefix).toBe("X");
  });

  it("deactivates when isActive=false", async () => {
    const entity = baseEntity();
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const result = await new VoucherTypesService(repo).update(ORG, entity.id, {
      isActive: false,
    });
    expect(result.isActive).toBe(false);
    expect(repo.update).toHaveBeenCalledWith(result);
  });

  it("activates when isActive=true on a deactivated entity", async () => {
    const entity = baseEntity().deactivate();
    const repo = fakeRepo({ findById: vi.fn().mockResolvedValue(entity) });
    const result = await new VoucherTypesService(repo).update(ORG, entity.id, {
      isActive: true,
    });
    expect(result.isActive).toBe(true);
  });
});

describe("VoucherTypesService.seedForOrg", () => {
  it("creates entities from seed inputs and persists via saveMany", async () => {
    const repo = fakeRepo();
    const service = new VoucherTypesService(repo);
    const result = await service.seedForOrg(ORG, [
      {
        code: "CI",
        prefix: "I",
        name: "Ingreso",
        description: "desc",
        isAdjustment: false,
      },
      {
        code: "CJ",
        prefix: "J",
        name: "Ajuste",
        description: "desc",
        isAdjustment: true,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]!.code).toBe("CI");
    expect(result[0]!.isAdjustment).toBe(false);
    expect(result[1]!.code).toBe("CJ");
    expect(result[1]!.isAdjustment).toBe(true);
    expect(repo.saveMany).toHaveBeenCalledOnce();
  });
});
