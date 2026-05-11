import { describe, it, expect, beforeEach } from "vitest";
import { ProductTypeService } from "../product-type.service";
import { ProductType } from "../../domain/product-type.entity";
import type { ProductTypesRepository } from "../../domain/product-type.repository";
import {
  ProductTypeNotFoundError,
  ProductTypeDuplicateCodeError,
} from "../../domain/errors/product-type-errors";

class InMemoryProductTypesRepository implements ProductTypesRepository {
  private readonly store = new Map<string, ProductType>();

  reset() {
    this.store.clear();
  }

  async findAll(
    orgId: string,
    filters?: { isActive?: boolean },
  ): Promise<ProductType[]> {
    return [...this.store.values()].filter((d) => {
      if (d.organizationId !== orgId) return false;
      if (filters?.isActive !== undefined && d.isActive !== filters.isActive)
        return false;
      return true;
    });
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<ProductType | null> {
    const d = this.store.get(id);
    return d && d.organizationId === orgId ? d : null;
  }

  async findByCode(
    orgId: string,
    code: string,
  ): Promise<ProductType | null> {
    return (
      [...this.store.values()].find(
        (d) => d.organizationId === orgId && d.code === code,
      ) ?? null
    );
  }

  async save(productType: ProductType): Promise<void> {
    // Mirror Prisma unique constraint (organizationId, code) — throw DuplicateCode on collision
    const existing = await this.findByCode(
      productType.organizationId,
      productType.code,
    );
    if (existing && existing.id !== productType.id) {
      throw new ProductTypeDuplicateCodeError(productType.code);
    }
    this.store.set(productType.id, productType);
  }
}

const ORG = "org-1";

const baseInput = (
  override: Partial<{
    code: string;
    name: string;
    sortOrder: number;
  }> = {},
) => ({
  code: override.code ?? "POLLO",
  name: override.name ?? "Pollo Entero",
  sortOrder: override.sortOrder,
});

describe("ProductTypeService", () => {
  let repo: InMemoryProductTypesRepository;
  let svc: ProductTypeService;

  beforeEach(() => {
    repo = new InMemoryProductTypesRepository();
    svc = new ProductTypeService(repo);
  });

  describe("list", () => {
    // α7
    it("returns product types scoped to org", async () => {
      const d = await svc.create(ORG, baseInput());
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(d.id);
    });

    // α8
    it("returns empty when no product types in org", async () => {
      const items = await svc.list(ORG);
      expect(items).toEqual([]);
    });

    // α9
    it("filters by isActive=true by default (excludes inactive)", async () => {
      const d1 = await svc.create(ORG, baseInput({ code: "POLLO" }));
      const d2 = await svc.create(ORG, baseInput({ code: "CERDO" }));
      await svc.deactivate(ORG, d2.id);
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(d1.id);
    });
  });

  describe("getById", () => {
    // α10
    it("returns product type by id within org", async () => {
      const d = await svc.create(ORG, baseInput());
      const found = await svc.getById(ORG, d.id);
      expect(found.id).toBe(d.id);
    });

    // α11
    it("throws ProductTypeNotFoundError when missing", async () => {
      await expect(svc.getById(ORG, "missing")).rejects.toThrow(
        ProductTypeNotFoundError,
      );
    });
  });

  describe("create", () => {
    // α12
    it("persists and returns the created ProductType", async () => {
      const d = await svc.create(ORG, baseInput({ code: "RES-X" }));
      expect(d.organizationId).toBe(ORG);
      expect(d.code).toBe("RES-X");
      const found = await svc.getById(ORG, d.id);
      expect(found.id).toBe(d.id);
    });

    // α13
    it("generates id + sets isActive=true initially", async () => {
      const d = await svc.create(ORG, baseInput());
      expect(typeof d.id).toBe("string");
      expect(d.id.length).toBeGreaterThan(0);
      expect(d.isActive).toBe(true);
    });

    // α14
    it("throws ProductTypeDuplicateCodeError when code already exists in org", async () => {
      await svc.create(ORG, baseInput({ code: "DUP" }));
      await expect(
        svc.create(ORG, baseInput({ code: "DUP" })),
      ).rejects.toThrow(ProductTypeDuplicateCodeError);
    });
  });

  describe("update", () => {
    // α15
    it("renames product type via update", async () => {
      const d = await svc.create(ORG, baseInput({ name: "Old" }));
      const updated = await svc.update(ORG, d.id, { name: "New" });
      expect(updated.name).toBe("New");
    });

    // α16
    it("changes code via update", async () => {
      const d = await svc.create(ORG, baseInput({ code: "OLD" }));
      const updated = await svc.update(ORG, d.id, { code: "NEW" });
      expect(updated.code).toBe("NEW");
    });

    // α17
    it("changes sortOrder via update", async () => {
      const d = await svc.create(ORG, baseInput({ sortOrder: 0 }));
      const updated = await svc.update(ORG, d.id, { sortOrder: 5 });
      expect(updated.sortOrder).toBe(5);
    });

    // α18
    it("throws ProductTypeNotFoundError when updating missing product type", async () => {
      await expect(
        svc.update(ORG, "missing", { name: "X" }),
      ).rejects.toThrow(ProductTypeNotFoundError);
    });
  });

  describe("deactivate", () => {
    // α19
    it("sets isActive=false on deactivate", async () => {
      const d = await svc.create(ORG, baseInput());
      const deactivated = await svc.deactivate(ORG, d.id);
      expect(deactivated.isActive).toBe(false);
    });

    // α20
    it("throws ProductTypeNotFoundError when deactivating missing", async () => {
      await expect(svc.deactivate(ORG, "missing")).rejects.toThrow(
        ProductTypeNotFoundError,
      );
    });
  });
});
