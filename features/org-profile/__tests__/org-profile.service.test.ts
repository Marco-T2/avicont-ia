/**
 * T4.1 — OrgProfileService tests.
 *
 * Strategy: mock repo via DI. No DB, no real Blob.
 *
 * Covers REQ-OP.1 (getOrCreate, update) and REQ-OP.3 (updateLogo swaps URL +
 * best-effort blob delete that never throws).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The service calls `del()` from @vercel/blob inside deleteLogoBlob.
// Mock the module so no HTTP call happens in tests.
vi.mock("@vercel/blob", () => ({
  del: vi.fn(),
}));

// The service calls logStructured from lib/logging on blob delete failure.
vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

import { del } from "@vercel/blob";
import { logStructured } from "@/lib/logging/structured";
import type { OrgProfileRepository } from "../org-profile.repository";
import { OrgProfileService } from "../org-profile.service";

function makeRepoMock(): OrgProfileRepository {
  return {
    findByOrgId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  } as unknown as OrgProfileRepository;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrgProfileService.getOrCreate", () => {
  it("returns the existing row WITHOUT calling create", async () => {
    const repo = makeRepoMock();
    const existing = { id: "p-1", organizationId: "org-1" } as never;
    vi.mocked(repo.findByOrgId).mockResolvedValue(existing);

    const service = new OrgProfileService(repo);
    const result = await service.getOrCreate("org-1");

    expect(result).toBe(existing);
    expect(repo.findByOrgId).toHaveBeenCalledWith("org-1");
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("creates a row when findByOrgId returns null", async () => {
    const repo = makeRepoMock();
    vi.mocked(repo.findByOrgId).mockResolvedValue(null);
    const created = { id: "p-new", organizationId: "org-1" } as never;
    vi.mocked(repo.create).mockResolvedValue(created);

    const service = new OrgProfileService(repo);
    const result = await service.getOrCreate("org-1");

    expect(result).toBe(created);
    expect(repo.create).toHaveBeenCalledWith("org-1");
  });

  it("does not double-insert: second call with existing returns same row", async () => {
    const repo = makeRepoMock();
    const existing = { id: "p-1", organizationId: "org-1" } as never;
    vi.mocked(repo.findByOrgId).mockResolvedValue(existing);

    const service = new OrgProfileService(repo);
    await service.getOrCreate("org-1");
    await service.getOrCreate("org-1");

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.findByOrgId).toHaveBeenCalledTimes(2);
  });
});

describe("OrgProfileService.update", () => {
  it("calls getOrCreate first, then update with the patch", async () => {
    const repo = makeRepoMock();
    const existing = { id: "p-1", organizationId: "org-1" } as never;
    const updated = {
      id: "p-1",
      organizationId: "org-1",
      razonSocial: "Empresa X",
    } as never;
    vi.mocked(repo.findByOrgId).mockResolvedValue(existing);
    vi.mocked(repo.update).mockResolvedValue(updated);

    const service = new OrgProfileService(repo);
    const result = await service.update("org-1", { razonSocial: "Empresa X" });

    expect(repo.findByOrgId).toHaveBeenCalledWith("org-1");
    expect(repo.update).toHaveBeenCalledWith("org-1", {
      razonSocial: "Empresa X",
    });
    expect(result).toBe(updated);
  });

  it("creates the row if missing, then applies the update", async () => {
    const repo = makeRepoMock();
    vi.mocked(repo.findByOrgId).mockResolvedValue(null);
    const created = { id: "p-new", organizationId: "org-1" } as never;
    vi.mocked(repo.create).mockResolvedValue(created);
    const updated = {
      id: "p-new",
      organizationId: "org-1",
      ciudad: "Sucre",
    } as never;
    vi.mocked(repo.update).mockResolvedValue(updated);

    const service = new OrgProfileService(repo);
    const result = await service.update("org-1", { ciudad: "Sucre" });

    expect(repo.create).toHaveBeenCalledWith("org-1");
    expect(repo.update).toHaveBeenCalledWith("org-1", { ciudad: "Sucre" });
    expect(result).toBe(updated);
  });
});

describe("OrgProfileService.updateLogo", () => {
  it("updates logoUrl and best-effort deletes the previous URL", async () => {
    const repo = makeRepoMock();
    const oldUrl = "https://blob.example.com/old.png";
    const newUrl = "https://blob.example.com/new.png";
    const before = { id: "p-1", organizationId: "org-1", logoUrl: oldUrl } as never;
    const after = { id: "p-1", organizationId: "org-1", logoUrl: newUrl } as never;
    vi.mocked(repo.findByOrgId).mockResolvedValue(before);
    vi.mocked(repo.update).mockResolvedValue(after);
    vi.mocked(del).mockResolvedValue(undefined as never);

    const service = new OrgProfileService(repo);
    const result = await service.updateLogo("org-1", newUrl);

    expect(repo.update).toHaveBeenCalledWith("org-1", { logoUrl: newUrl });
    expect(del).toHaveBeenCalledWith(oldUrl, expect.any(Object));
    expect(result).toBe(after);
  });

  it("skips delete when there was no previous URL", async () => {
    const repo = makeRepoMock();
    const before = { id: "p-1", organizationId: "org-1", logoUrl: null } as never;
    const after = {
      id: "p-1",
      organizationId: "org-1",
      logoUrl: "https://blob.example.com/new.png",
    } as never;
    vi.mocked(repo.findByOrgId).mockResolvedValue(before);
    vi.mocked(repo.update).mockResolvedValue(after);

    const service = new OrgProfileService(repo);
    await service.updateLogo("org-1", "https://blob.example.com/new.png");

    expect(del).not.toHaveBeenCalled();
  });
});

describe("OrgProfileService.deleteLogoBlob (best-effort)", () => {
  it("swallows blob errors and never throws", async () => {
    const repo = makeRepoMock();
    vi.mocked(del).mockRejectedValue(new Error("network down"));

    const service = new OrgProfileService(repo);
    await expect(
      service.deleteLogoBlob("https://blob.example.com/old.png"),
    ).resolves.toBeUndefined();

    expect(del).toHaveBeenCalled();
  });

  it("calls del with the URL on the happy path", async () => {
    const repo = makeRepoMock();
    vi.mocked(del).mockResolvedValue(undefined as never);

    const service = new OrgProfileService(repo);
    await service.deleteLogoBlob("https://blob.example.com/happy.png");

    expect(del).toHaveBeenCalledWith(
      "https://blob.example.com/happy.png",
      expect.any(Object),
    );
  });

  it("logs blob_orphan_detected via logStructured when del rejects", async () => {
    const repo = makeRepoMock();
    vi.mocked(del).mockRejectedValue(new Error("network down"));

    const service = new OrgProfileService(repo);
    await service.deleteLogoBlob(
      "https://blob.example.com/orphan.png",
      "org-1",
    );

    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "blob_orphan_detected",
        orgId: "org-1",
        orphanUrl: "https://blob.example.com/orphan.png",
        error: "network down",
      }),
    );
  });

  it("does not call logStructured when del resolves", async () => {
    const repo = makeRepoMock();
    vi.mocked(del).mockResolvedValue(undefined as never);

    const service = new OrgProfileService(repo);
    await service.deleteLogoBlob("https://blob.example.com/ok.png", "org-1");

    expect(logStructured).not.toHaveBeenCalled();
  });
});
