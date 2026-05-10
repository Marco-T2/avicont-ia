import { describe, it, expect, beforeEach } from "vitest";
import { FarmService } from "../farm.service";
import { Farm } from "../../domain/farm.entity";
import type {
  FarmRepository,
  FarmFilters,
} from "../../domain/farm.repository";
import type { MemberInquiryPort } from "../../domain/ports/member-inquiry.port";
import { NotFoundError, ConflictError } from "@/features/shared/errors";

class InMemoryFarmRepository implements FarmRepository {
  private readonly store = new Map<string, Farm>();

  reset() {
    this.store.clear();
  }

  preload(...farms: Farm[]) {
    for (const f of farms) this.store.set(f.id, f);
  }

  async findAll(orgId: string, filters?: FarmFilters): Promise<Farm[]> {
    return [...this.store.values()].filter((f) => {
      if (f.organizationId !== orgId) return false;
      if (filters?.memberId && f.memberId !== filters.memberId) return false;
      return true;
    });
  }

  async findById(orgId: string, id: string): Promise<Farm | null> {
    const f = this.store.get(id);
    return f && f.organizationId === orgId ? f : null;
  }

  async findByName(orgId: string, name: string): Promise<Farm | null> {
    return (
      [...this.store.values()].find(
        (f) => f.organizationId === orgId && f.name === name,
      ) ?? null
    );
  }

  async save(f: Farm): Promise<void> {
    this.store.set(f.id, f);
  }

  async update(f: Farm): Promise<void> {
    this.store.set(f.id, f);
  }

  async delete(orgId: string, id: string): Promise<void> {
    const f = this.store.get(id);
    if (f && f.organizationId === orgId) this.store.delete(id);
  }
}

class StubMemberInquiryPort implements MemberInquiryPort {
  public calls: Array<{ orgId: string; memberId: string }> = [];
  public shouldThrow: Error | null = null;

  async assertActive(
    organizationId: string,
    memberId: string,
  ): Promise<void> {
    this.calls.push({ orgId: organizationId, memberId });
    if (this.shouldThrow) throw this.shouldThrow;
  }
}

const ORG = "org-1";
const MEMBER = "member-1";

const baseInput = (
  override: Partial<{
    name: string;
    location: string | null;
    memberId: string;
  }> = {},
) => ({
  name: override.name ?? "Granja San Antonio",
  location: override.location ?? "Km 5 Ruta 4",
  memberId: override.memberId ?? MEMBER,
});

describe("FarmService", () => {
  let repo: InMemoryFarmRepository;
  let members: StubMemberInquiryPort;
  let svc: FarmService;

  beforeEach(() => {
    repo = new InMemoryFarmRepository();
    members = new StubMemberInquiryPort();
    svc = new FarmService(repo, members);
  });

  describe("list", () => {
    // α6
    it("returns farms scoped to org", async () => {
      const f = await svc.create(ORG, baseInput());
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(f.id);
    });

    // α7
    it("filters by memberId", async () => {
      await svc.create(ORG, baseInput());
      members.calls = [];
      members.shouldThrow = null;
      await svc.create(ORG, {
        ...baseInput({ name: "Granja 2" }),
        memberId: "member-2",
      });
      const items = await svc.list(ORG, { memberId: MEMBER });
      expect(items).toHaveLength(1);
      expect(items[0]?.memberId).toBe(MEMBER);
    });

    // α8
    it("returns empty when no farms in org", async () => {
      const items = await svc.list(ORG);
      expect(items).toEqual([]);
    });

    // α9
    it("does not return farms from other orgs", async () => {
      await svc.create(ORG, baseInput());
      const items = await svc.list("other-org");
      expect(items).toEqual([]);
    });
  });

  describe("getById", () => {
    // α10
    it("returns the farm when found", async () => {
      const f = await svc.create(ORG, baseInput());
      const found = await svc.getById(ORG, f.id);
      expect(found.id).toBe(f.id);
    });

    // α11
    it("throws NotFoundError when missing", async () => {
      await expect(svc.getById(ORG, "missing")).rejects.toThrow(NotFoundError);
    });

    // α12
    it("does not return farms from other orgs", async () => {
      const f = await svc.create(ORG, baseInput());
      await expect(svc.getById("other-org", f.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    // α13
    it("calls members.assertActive before saving", async () => {
      await svc.create(ORG, baseInput());
      expect(members.calls).toEqual([{ orgId: ORG, memberId: MEMBER }]);
    });

    // α14
    it("propagates assertActive errors and does not save", async () => {
      members.shouldThrow = new Error("inactive");
      await expect(svc.create(ORG, baseInput())).rejects.toThrow("inactive");
      const items = await svc.list(ORG);
      expect(items).toHaveLength(0);
    });

    // α15
    it("throws ConflictError when name already exists in org", async () => {
      await svc.create(ORG, baseInput({ name: "Duplicada" }));
      members.calls = [];
      members.shouldThrow = null;
      await expect(
        svc.create(ORG, baseInput({ name: "Duplicada" })),
      ).rejects.toThrow(ConflictError);
    });

    // α16
    it("returns Farm with all fields", async () => {
      const f = await svc.create(
        ORG,
        baseInput({ name: "Nueva", location: "Km 10" }),
      );
      expect(f).toBeInstanceOf(Farm);
      expect(f.name).toBe("Nueva");
      expect(f.location).toBe("Km 10");
      expect(f.memberId).toBe(MEMBER);
      expect(f.organizationId).toBe(ORG);
    });

    // α17
    it("accepts null location", async () => {
      const f = await svc.create(ORG, baseInput({ location: null }));
      expect(f.location).toBeNull();
    });
  });

  describe("update", () => {
    // α18
    it("throws NotFoundError when farm missing", async () => {
      await expect(
        svc.update(ORG, "missing", { name: "X" }),
      ).rejects.toThrow(NotFoundError);
    });

    // α19
    it("updates name and location preserving id and createdAt", async () => {
      const f = await svc.create(ORG, baseInput());
      const updated = await svc.update(ORG, f.id, {
        name: "Renombrada",
        location: "Km 20",
      });
      expect(updated.id).toBe(f.id);
      expect(updated.name).toBe("Renombrada");
      expect(updated.location).toBe("Km 20");
      expect(updated.createdAt).toEqual(f.createdAt);
    });

    // α20
    it("rejects rename to existing farm name with ConflictError", async () => {
      const f1 = await svc.create(ORG, baseInput({ name: "Granja A" }));
      members.calls = [];
      members.shouldThrow = null;
      await svc.create(ORG, baseInput({ name: "Granja B" }));
      await expect(
        svc.update(ORG, f1.id, { name: "Granja B" }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("delete", () => {
    // α21
    it("throws NotFoundError when farm missing", async () => {
      await expect(svc.delete(ORG, "missing")).rejects.toThrow(NotFoundError);
    });

    // α22
    it("removes the farm from the repository", async () => {
      const f = await svc.create(ORG, baseInput());
      await svc.delete(ORG, f.id);
      const items = await svc.list(ORG);
      expect(items).toHaveLength(0);
    });
  });
});
