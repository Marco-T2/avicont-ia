import { describe, it, expect } from "vitest";
import type { ProductType as PrismaProductType } from "@/generated/prisma/client";
import { toDomain, toPersistence } from "../product-type.mapper";
import { ProductType } from "../../domain/product-type.entity";

const row = (
  override: Partial<PrismaProductType> = {},
): PrismaProductType => ({
  id: "pt-1",
  organizationId: "org-1",
  code: "POLLO",
  name: "Pollo Entero",
  isActive: true,
  sortOrder: 0,
  createdAt: new Date("2026-01-15"),
  updatedAt: new Date("2026-01-15"),
  ...override,
});

describe("product-type mapper", () => {
  describe("toDomain()", () => {
    // α21
    it("hydrates a ProductType from a Prisma row", () => {
      const d = toDomain(row());
      expect(d).toBeInstanceOf(ProductType);
      expect(d.id).toBe("pt-1");
      expect(d.organizationId).toBe("org-1");
    });

    // α22
    it("preserves sortOrder field", () => {
      const zero = toDomain(row({ sortOrder: 0 }));
      const five = toDomain(row({ sortOrder: 5 }));
      expect(zero.sortOrder).toBe(0);
      expect(five.sortOrder).toBe(5);
    });

    // α23
    it("preserves isActive boolean", () => {
      const active = toDomain(row({ isActive: true }));
      const inactive = toDomain(row({ isActive: false }));
      expect(active.isActive).toBe(true);
      expect(inactive.isActive).toBe(false);
    });
  });

  describe("toPersistence()", () => {
    const buildEntity = () =>
      ProductType.create({
        organizationId: "org-1",
        code: "RES-X",
        name: "Res X",
        sortOrder: 3,
      });

    // α24
    it("returns a Prisma create payload", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.id).toBe(entity.id);
      expect(data.code).toBe("RES-X");
      expect(data.organizationId).toBe("org-1");
      expect(data.sortOrder).toBe(3);
    });

    // α25
    it("preserves createdAt + updatedAt timestamps", () => {
      const entity = buildEntity();
      const data = toPersistence(entity);
      expect(data.createdAt).toBeInstanceOf(Date);
      expect(data.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("roundtrip", () => {
    // α26
    it("toPersistence(toDomain(row)) yields equivalent payload", () => {
      const original = row();
      const entity = toDomain(original);
      const data = toPersistence(entity);
      expect(data.id).toBe(original.id);
      expect(data.code).toBe(original.code);
      expect(data.organizationId).toBe(original.organizationId);
      expect(data.sortOrder).toBe(original.sortOrder);
      expect(data.createdAt.getTime()).toBe(original.createdAt.getTime());
    });
  });
});
