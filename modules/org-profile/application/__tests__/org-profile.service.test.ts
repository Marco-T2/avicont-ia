import { describe, it, expect, beforeEach } from "vitest";
import { OrgProfileService } from "../org-profile.service";
import {
  OrgProfile,
  type UpdateOrgProfileInput,
} from "../../domain/org-profile.entity";
import type { OrgProfileRepository } from "../../domain/org-profile.repository";
import type { BlobStoragePort } from "../../domain/ports/blob-storage.port";

// ── InMemory repo ──
class InMemoryOrgProfileRepository implements OrgProfileRepository {
  private readonly store = new Map<string, OrgProfile>();

  reset() {
    this.store.clear();
  }

  async findByOrgId(organizationId: string): Promise<OrgProfile | null> {
    return (
      [...this.store.values()].find(
        (e) => e.organizationId === organizationId,
      ) ?? null
    );
  }

  async save(entity: OrgProfile): Promise<void> {
    this.store.set(entity.organizationId, entity);
  }
}

// ── Fake blob storage ──
class FakeBlobStorage implements BlobStoragePort {
  readonly deleted: string[] = [];

  async del(url: string): Promise<void> {
    this.deleted.push(url);
  }
}

const ORG = "org-1";

describe("OrgProfileService", () => {
  let repo: InMemoryOrgProfileRepository;
  let blobStorage: FakeBlobStorage;
  let svc: OrgProfileService;

  beforeEach(() => {
    repo = new InMemoryOrgProfileRepository();
    blobStorage = new FakeBlobStorage();
    svc = new OrgProfileService(repo, blobStorage);
  });

  describe("getOrCreate", () => {
    // α9
    it("creates a default profile when no row exists and returns its snapshot", async () => {
      const snapshot = await svc.getOrCreate(ORG);
      expect(snapshot.organizationId).toBe(ORG);
      expect(snapshot.razonSocial).toBe("");
      expect(snapshot.nit).toBe("");
      expect(snapshot.logoUrl).toBeNull();
      expect(typeof snapshot.id).toBe("string");
    });

    // α10
    it("returns the existing profile without creating a second one", async () => {
      const first = await svc.getOrCreate(ORG);
      const second = await svc.getOrCreate(ORG);
      expect(second.id).toBe(first.id);
    });
  });

  describe("update", () => {
    // α11
    it("creates the profile if missing, then applies the patch", async () => {
      const snapshot = await svc.update(ORG, { razonSocial: "Empresa X", ciudad: "Sucre" });
      expect(snapshot.razonSocial).toBe("Empresa X");
      expect(snapshot.ciudad).toBe("Sucre");
      expect(snapshot.nit).toBe(""); // untouched
    });

    // α12
    it("updates existing profile — partial patch preserves other fields", async () => {
      await svc.update(ORG, { razonSocial: "A", nit: "111" });
      const snapshot = await svc.update(ORG, { ciudad: "La Paz" });
      expect(snapshot.razonSocial).toBe("A"); // preserved
      expect(snapshot.nit).toBe("111"); // preserved
      expect(snapshot.ciudad).toBe("La Paz"); // new
    });

    // α13
    it("sets nullable field to null to clear it (nroPatronal)", async () => {
      await svc.update(ORG, { nroPatronal: "NRP-123" });
      const snapshot = await svc.update(ORG, { nroPatronal: null });
      expect(snapshot.nroPatronal).toBeNull();
    });
  });

  describe("updateLogo", () => {
    // α14
    it("sets logoUrl and deletes previous blob when URL changes", async () => {
      const oldUrl = "https://blob.example.com/old.png";
      const newUrl = "https://blob.example.com/new.png";
      await svc.update(ORG, { logoUrl: oldUrl });

      const snapshot = await svc.updateLogo(ORG, newUrl);
      expect(snapshot.logoUrl).toBe(newUrl);
      expect(blobStorage.deleted).toEqual([oldUrl]);
    });

    // α15
    it("skips blob delete when there was no previous URL", async () => {
      const snapshot = await svc.updateLogo(ORG, "https://blob.example.com/first.png");
      expect(snapshot.logoUrl).toBe("https://blob.example.com/first.png");
      expect(blobStorage.deleted).toHaveLength(0);
    });

    // α16
    it("skips blob delete when new URL equals previous URL", async () => {
      const url = "https://blob.example.com/same.png";
      await svc.update(ORG, { logoUrl: url });

      await svc.updateLogo(ORG, url);
      expect(blobStorage.deleted).toHaveLength(0);
    });
  });
});
