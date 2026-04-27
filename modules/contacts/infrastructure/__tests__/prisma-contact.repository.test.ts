import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { PrismaContactRepository } from "../prisma-contact.repository";
import { Contact } from "../../domain/contact.entity";

const ROW = {
  id: "c1",
  organizationId: "org-1",
  type: "CLIENTE" as const,
  name: "Acme",
  nit: "12345",
  email: null,
  phone: null,
  address: null,
  paymentTermsDays: 30,
  creditLimit: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({ contact: overrides }) as unknown as PrismaClient;

describe("PrismaContactRepository.findAll", () => {
  it("scopes by organizationId and orders by name asc", async () => {
    const findMany = vi.fn().mockResolvedValue([ROW]);
    const repo = new PrismaContactRepository(dbWith({ findMany }));
    await repo.findAll("org-1");
    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      orderBy: { name: "asc" },
    });
  });

  it("applies the type filter", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaContactRepository(dbWith({ findMany }));
    await repo.findAll("org-1", { type: "PROVEEDOR" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "PROVEEDOR" }),
      }),
    );
  });

  it("applies the excludeTypes filter (notIn) when array is non-empty", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaContactRepository(dbWith({ findMany }));
    await repo.findAll("org-1", { excludeTypes: ["CLIENTE", "OTRO"] });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: { notIn: ["CLIENTE", "OTRO"] },
        }),
      }),
    );
  });

  it("ignores excludeTypes when empty array", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaContactRepository(dbWith({ findMany }));
    await repo.findAll("org-1", { excludeTypes: [] });
    const arg = findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(arg.where.type).toBeUndefined();
  });

  it("applies the search filter as case-insensitive OR on name and nit", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repo = new PrismaContactRepository(dbWith({ findMany }));
    await repo.findAll("org-1", { search: "acme" });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "acme", mode: "insensitive" } },
            { nit: { contains: "acme", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("returns domain entities, not raw rows", async () => {
    const findMany = vi.fn().mockResolvedValue([ROW]);
    const repo = new PrismaContactRepository(dbWith({ findMany }));
    const result = await repo.findAll("org-1");
    expect(result[0]).toBeInstanceOf(Contact);
    expect(result[0]!.name).toBe("Acme");
  });
});

describe("PrismaContactRepository.findById", () => {
  it("scopes by id and organizationId", async () => {
    const findFirst = vi.fn().mockResolvedValue(ROW);
    const repo = new PrismaContactRepository(dbWith({ findFirst }));
    await repo.findById("org-1", "c1");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: "org-1" },
    });
  });

  it("returns null when not found", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const repo = new PrismaContactRepository(dbWith({ findFirst }));
    expect(await repo.findById("org-1", "c1")).toBeNull();
  });
});

describe("PrismaContactRepository.findByNit", () => {
  it("scopes by nit and organizationId", async () => {
    const findFirst = vi.fn().mockResolvedValue(ROW);
    const repo = new PrismaContactRepository(dbWith({ findFirst }));
    await repo.findByNit("org-1", "12345");
    expect(findFirst).toHaveBeenCalledWith({
      where: { nit: "12345", organizationId: "org-1" },
    });
  });
});

describe("PrismaContactRepository.save", () => {
  it("calls db.contact.create with the persistence payload", async () => {
    const create = vi.fn().mockResolvedValue(ROW);
    const repo = new PrismaContactRepository(dbWith({ create }));
    const c = Contact.create({
      organizationId: "org-1",
      type: "CLIENTE",
      name: "Acme",
    });
    await repo.save(c);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        name: "Acme",
        type: "CLIENTE",
        isActive: true,
      }),
    });
  });
});

describe("PrismaContactRepository.update", () => {
  it("scopes by id and organizationId, sends the update payload", async () => {
    const update = vi.fn().mockResolvedValue(ROW);
    const repo = new PrismaContactRepository(dbWith({ update }));
    const c = Contact.fromPersistence({
      id: "c1",
      organizationId: "org-1",
      type: "CLIENTE",
      name: "Renamed",
      nit: null,
      email: null,
      phone: null,
      address: null,
      paymentTermsDays: (await import("../../domain/value-objects/payment-terms-days")).PaymentTermsDays.of(30),
      creditLimit: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await repo.update(c);
    expect(update).toHaveBeenCalledWith({
      where: { id: "c1", organizationId: "org-1" },
      data: expect.objectContaining({ name: "Renamed" }),
    });
  });
});
