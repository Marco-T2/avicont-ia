import { describe, it, expect, beforeEach } from "vitest";
import { OperationalDocTypeService } from "../operational-doc-type.service";
import { OperationalDocType } from "../../domain/operational-doc-type.entity";
import type { OperationalDocTypesRepository } from "../../domain/operational-doc-type.repository";
import {
  OperationalDocTypeNotFoundError,
  OperationalDocTypeDuplicateCodeError,
  OperationalDocTypeInUseError,
} from "../../domain/errors/operational-doc-type-errors";
import type { OperationalDocDirection } from "../../domain/value-objects/operational-doc-direction";

class InMemoryOperationalDocTypesRepository
  implements OperationalDocTypesRepository
{
  private readonly store = new Map<string, OperationalDocType>();
  activePaymentsByDocType = new Map<string, number>();

  reset() {
    this.store.clear();
    this.activePaymentsByDocType.clear();
  }

  async findAll(
    orgId: string,
    filters?: { isActive?: boolean; direction?: OperationalDocDirection },
  ): Promise<OperationalDocType[]> {
    return [...this.store.values()].filter((d) => {
      if (d.organizationId !== orgId) return false;
      if (filters?.isActive !== undefined && d.isActive !== filters.isActive)
        return false;
      if (filters?.direction !== undefined && d.direction !== filters.direction)
        return false;
      return true;
    });
  }

  async findById(
    orgId: string,
    id: string,
  ): Promise<OperationalDocType | null> {
    const d = this.store.get(id);
    return d && d.organizationId === orgId ? d : null;
  }

  async findByCode(
    orgId: string,
    code: string,
  ): Promise<OperationalDocType | null> {
    return (
      [...this.store.values()].find(
        (d) => d.organizationId === orgId && d.code === code,
      ) ?? null
    );
  }

  async save(docType: OperationalDocType): Promise<void> {
    // Mirror Prisma unique constraint (organizationId, code) — throw DuplicateCode on collision
    const existing = await this.findByCode(docType.organizationId, docType.code);
    if (existing && existing.id !== docType.id) {
      throw new OperationalDocTypeDuplicateCodeError(docType.code);
    }
    this.store.set(docType.id, docType);
  }

  async countActivePayments(
    _orgId: string,
    docTypeId: string,
  ): Promise<number> {
    return this.activePaymentsByDocType.get(docTypeId) ?? 0;
  }
}

const ORG = "org-1";

const baseInput = (
  override: Partial<{
    code: string;
    name: string;
    direction: OperationalDocDirection;
  }> = {},
) => ({
  code: override.code ?? "FACT-A",
  name: override.name ?? "Factura A",
  direction: override.direction ?? ("PAGO" as OperationalDocDirection),
});

describe("OperationalDocTypeService", () => {
  let repo: InMemoryOperationalDocTypesRepository;
  let svc: OperationalDocTypeService;

  beforeEach(() => {
    repo = new InMemoryOperationalDocTypesRepository();
    svc = new OperationalDocTypeService(repo);
  });

  describe("list", () => {
    // α8
    it("returns doc types scoped to org", async () => {
      const d = await svc.create(ORG, baseInput());
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(d.id);
    });

    // α9
    it("returns empty when no doc types in org", async () => {
      const items = await svc.list(ORG);
      expect(items).toEqual([]);
    });

    // α10
    it("filters by isActive=true by default (excludes inactive)", async () => {
      const d1 = await svc.create(ORG, baseInput({ code: "FACT-A" }));
      const d2 = await svc.create(ORG, baseInput({ code: "FACT-B" }));
      await svc.deactivate(ORG, d2.id);
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(d1.id);
    });
  });

  describe("getById", () => {
    // α11
    it("returns doc type by id within org", async () => {
      const d = await svc.create(ORG, baseInput());
      const found = await svc.getById(ORG, d.id);
      expect(found.id).toBe(d.id);
    });

    // α12
    it("throws OperationalDocTypeNotFoundError when missing", async () => {
      await expect(svc.getById(ORG, "missing")).rejects.toThrow(
        OperationalDocTypeNotFoundError,
      );
    });
  });

  describe("create", () => {
    // α13
    it("persists and returns the created OperationalDocType", async () => {
      const d = await svc.create(ORG, baseInput({ code: "REM-X" }));
      expect(d.organizationId).toBe(ORG);
      expect(d.code).toBe("REM-X");
      const found = await svc.getById(ORG, d.id);
      expect(found.id).toBe(d.id);
    });

    // α14
    it("generates id + sets isActive=true initially", async () => {
      const d = await svc.create(ORG, baseInput());
      expect(typeof d.id).toBe("string");
      expect(d.id.length).toBeGreaterThan(0);
      expect(d.isActive).toBe(true);
    });

    // α15
    it("throws OperationalDocTypeDuplicateCodeError when code already exists in org", async () => {
      await svc.create(ORG, baseInput({ code: "DUP" }));
      await expect(svc.create(ORG, baseInput({ code: "DUP" }))).rejects.toThrow(
        OperationalDocTypeDuplicateCodeError,
      );
    });
  });

  describe("update", () => {
    // α16
    it("renames doc type via update", async () => {
      const d = await svc.create(ORG, baseInput({ name: "Old" }));
      const updated = await svc.update(ORG, d.id, { name: "New" });
      expect(updated.name).toBe("New");
    });

    // α17
    it("changes direction via update", async () => {
      const d = await svc.create(
        ORG,
        baseInput({ direction: "PAGO" as OperationalDocDirection }),
      );
      const updated = await svc.update(ORG, d.id, {
        direction: "COBRO" as OperationalDocDirection,
      });
      expect(updated.direction).toBe("COBRO");
    });

    // α18
    it("throws OperationalDocTypeNotFoundError when updating missing doc type", async () => {
      await expect(
        svc.update(ORG, "missing", { name: "X" }),
      ).rejects.toThrow(OperationalDocTypeNotFoundError);
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
    it("throws OperationalDocTypeNotFoundError when deactivating missing", async () => {
      await expect(svc.deactivate(ORG, "missing")).rejects.toThrow(
        OperationalDocTypeNotFoundError,
      );
    });

    // α21
    it("throws OperationalDocTypeInUseError when active payments > 0", async () => {
      const d = await svc.create(ORG, baseInput());
      repo.activePaymentsByDocType.set(d.id, 3);
      await expect(svc.deactivate(ORG, d.id)).rejects.toThrow(
        OperationalDocTypeInUseError,
      );
    });
  });
});
