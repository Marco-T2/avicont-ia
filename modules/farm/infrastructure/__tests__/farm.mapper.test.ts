import { describe, it, expect } from "vitest";
import { type Farm as PrismaFarm } from "@/generated/prisma/client";
import { toDomain, toPersistence } from "../farm.mapper";
import { Farm } from "../../domain/farm.entity";

const row = (override: Partial<PrismaFarm> = {}): PrismaFarm => ({
  id: "farm-1",
  organizationId: "org-1",
  name: "Granja Norte",
  location: "Buenos Aires",
  memberId: "member-1",
  createdAt: new Date("2026-04-01"),
  updatedAt: new Date("2026-04-15"),
  ...override,
});

describe("farm mapper", () => {
  describe("toDomain()", () => {
    it("hydrates a Farm from a Prisma row", () => {
      const f = toDomain(row());
      expect(f).toBeInstanceOf(Farm);
      expect(f.id).toBe("farm-1");
      expect(f.organizationId).toBe("org-1");
      expect(f.name).toBe("Granja Norte");
      expect(f.location).toBe("Buenos Aires");
      expect(f.memberId).toBe("member-1");
    });

    it("preserves location null vs string", () => {
      const f = toDomain(row({ location: null }));
      expect(f.location).toBeNull();
    });
  });

  describe("toPersistence()", () => {
    it("returns a Prisma-compatible payload preserving entity.id", () => {
      const entity = Farm.create({
        organizationId: "org-1",
        name: "Granja Norte",
        location: "Buenos Aires",
        memberId: "member-1",
      });
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.organizationId).toBe("org-1");
      expect(data.name).toBe("Granja Norte");
      expect(data.location).toBe("Buenos Aires");
      expect(data.memberId).toBe("member-1");
    });

    it("preserves location null (NOT undefined)", () => {
      const entity = Farm.create({
        organizationId: "org-1",
        name: "Granja",
        location: null,
        memberId: "member-1",
      });
      const data = toPersistence(entity);
      expect(data.location).toBeNull();
    });

    it("preserves timestamps (createdAt+updatedAt)", () => {
      const entity = Farm.create({
        organizationId: "org-1",
        name: "Granja",
        memberId: "member-1",
      });
      const data = toPersistence(entity);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("roundtrip", () => {
    it("toPersistence(toDomain(row)) yields equivalent payload", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.name).toBe(original.name);
      expect(data.location).toBe(original.location);
      expect(data.memberId).toBe(original.memberId);
      expect(data.createdAt.getTime()).toBe(original.createdAt.getTime());
    });
  });
});
