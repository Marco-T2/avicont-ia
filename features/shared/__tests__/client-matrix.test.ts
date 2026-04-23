/**
 * client-matrix.test.ts — buildClientMatrixSnapshot tests
 *
 * Verifies that buildClientMatrixSnapshot triggers ensureOrgSeeded (D.6 completeness)
 * when the matrix is empty, so pre-PR8.1 orgs auto-seed on first layout render.
 *
 * (a) empty matrix → ensureOrgSeeded triggers the seed, snapshot is built from populated matrix
 * (b) role present in matrix → snapshot returned with correct fields
 * (c) role absent in matrix → returns null (deny by default)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../permissions.cache", () => ({
  getMatrix: vi.fn(),
  revalidateOrgMatrix: vi.fn(),
  _resetCache: vi.fn(),
  _setLoader: vi.fn(),
  ensureOrgSeeded: vi.fn(),
}));

import { buildClientMatrixSnapshot } from "@/features/shared/client-matrix";
import { ensureOrgSeeded } from "@/features/shared/permissions.cache";
import type { OrgMatrix } from "@/features/shared/permissions.cache";
import type { Resource, PostableResource } from "@/features/shared/permissions";

const mockedEnsureOrgSeeded = vi.mocked(ensureOrgSeeded);

const makeMatrixWithRole = (orgId: string, role: string): OrgMatrix => ({
  orgId,
  roles: new Map([
    [role, {
      permissionsRead: new Set<Resource>(["sales", "reports"]),
      permissionsWrite: new Set<Resource>(["sales"]),
      canPost: new Set<PostableResource>(["sales"]),
      canClose: new Set<Resource>(),
      canReopen: new Set<Resource>(),
      isSystem: true,
    }],
  ]),
  loadedAt: Date.now(),
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildClientMatrixSnapshot (D.6 completeness)", () => {
  it("(a) calls ensureOrgSeeded so empty orgs auto-seed on layout render", async () => {
    const populatedMatrix = makeMatrixWithRole("org-a", "admin");

    // First call returns empty (simulating trigger), ensureOrgSeeded returns populated
    mockedEnsureOrgSeeded.mockResolvedValue(populatedMatrix);

    const result = await buildClientMatrixSnapshot("org-a", "admin");

    expect(mockedEnsureOrgSeeded).toHaveBeenCalledWith("org-a");
    expect(result).not.toBeNull();
    expect(result!.role).toBe("admin");
    expect(result!.permissionsRead).toContain("sales");
  });

  it("(b) role present in matrix → snapshot built with correct serialized fields", async () => {
    const matrix = makeMatrixWithRole("org-b", "contador");
    mockedEnsureOrgSeeded.mockResolvedValue(matrix);

    const result = await buildClientMatrixSnapshot("org-b", "contador");

    expect(result).not.toBeNull();
    expect(result!.orgId).toBe("org-b");
    expect(result!.role).toBe("contador");
    expect(Array.isArray(result!.permissionsRead)).toBe(true);
    expect(Array.isArray(result!.permissionsWrite)).toBe(true);
    expect(Array.isArray(result!.canPost)).toBe(true);
    expect(result!.permissionsRead).toContain("sales");
    expect(result!.permissionsWrite).toContain("sales");
    expect(result!.canPost).toContain("sales");
  });

  it("(c) role absent in matrix → returns null (deny by default)", async () => {
    const matrix = makeMatrixWithRole("org-c", "owner");
    mockedEnsureOrgSeeded.mockResolvedValue(matrix);

    const result = await buildClientMatrixSnapshot("org-c", "nonexistent-role");

    expect(result).toBeNull();
  });
});
