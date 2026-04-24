/**
 * PR1.4 RED — permissions.cache module tests (REQ-P.5 / D.3)
 *
 * 7 unit tests:
 * (a) cache miss triggers DB load
 * (b) cache hit skips DB
 * (c) TTL=60s expiry reloads (fake timer)
 * (d) revalidateOrgMatrix evicts only target org
 * (e) single-flight: two concurrent calls issue one DB read
 * (f) LRU cap 1000 drops oldest
 * (g) _resetCache() clears all
 *
 * ensureOrgSeeded (D.6 completeness):
 * (h) when loader returns empty matrix, seeder is called, cache revalidated, populated matrix returned
 * (i) when loader returns non-empty matrix, seeder NOT called, matrix returned as-is
 * (j) when seedOrgSystemRoles throws, ensureOrgSeeded propagates the error (fail-loud — Audit H #2)
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  getMatrix,
  revalidateOrgMatrix,
  _resetCache,
  _setLoader,
  ensureOrgSeeded,
  type OrgMatrix,
} from "../permissions.cache";
import { seedOrgSystemRoles } from "@/prisma/seed-system-roles";
import type { Resource, PostableResource } from "../permissions";

vi.mock("@/prisma/seed-system-roles", () => ({
  buildSystemRolePayloads: vi.fn(),
  seedSystemRoles: vi.fn(),
  seedOrgSystemRoles: vi.fn().mockResolvedValue(undefined),
}));

const mockedSeedOrgSystemRoles = vi.mocked(seedOrgSystemRoles);

const makeMatrix = (orgId: string): OrgMatrix => ({
  orgId,
  roles: new Map(),
  loadedAt: Date.now(),
});

const makePopulatedMatrix = (orgId: string): OrgMatrix => ({
  orgId,
  roles: new Map([
    ["owner", {
      permissionsRead: new Set<Resource>(),
      permissionsWrite: new Set<Resource>(),
      canPost: new Set<PostableResource>(),
      canClose: new Set<Resource>(),
      canReopen: new Set<Resource>(),
      isSystem: true,
    }],
  ]),
  loadedAt: Date.now(),
});

beforeEach(() => {
  _resetCache();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  _resetCache();
});

describe("PR1.4 — permissions.cache", () => {
  it("(a) cache miss triggers DB load exactly once", async () => {
    const loader = vi.fn().mockResolvedValue(makeMatrix("org-a"));
    _setLoader(loader);

    await getMatrix("org-a");
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader).toHaveBeenCalledWith("org-a");
  });

  it("(b) cache hit skips DB load on second call", async () => {
    const loader = vi.fn().mockResolvedValue(makeMatrix("org-b"));
    _setLoader(loader);

    await getMatrix("org-b");
    await getMatrix("org-b");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("(c) TTL=60s expiry reloads after 60 seconds", async () => {
    const loader = vi.fn().mockResolvedValue(makeMatrix("org-c"));
    _setLoader(loader);

    // First call — loads from DB
    await getMatrix("org-c");
    expect(loader).toHaveBeenCalledTimes(1);

    // Advance time by 59s — still in TTL
    vi.advanceTimersByTime(59_000);
    await getMatrix("org-c");
    expect(loader).toHaveBeenCalledTimes(1);

    // Advance past 60s threshold (1ms more)
    vi.advanceTimersByTime(1_001);
    await getMatrix("org-c");
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("(d) revalidateOrgMatrix evicts only the target org", async () => {
    const loader = vi.fn().mockImplementation((orgId: string) =>
      Promise.resolve(makeMatrix(orgId)),
    );
    _setLoader(loader);

    await getMatrix("org-d1");
    await getMatrix("org-d2");
    expect(loader).toHaveBeenCalledTimes(2);

    revalidateOrgMatrix("org-d1");

    // org-d1 should reload
    await getMatrix("org-d1");
    expect(loader).toHaveBeenCalledTimes(3);

    // org-d2 should still hit cache
    await getMatrix("org-d2");
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it("(e) single-flight: two concurrent calls issue one DB read", async () => {
    let resolveLoad!: (m: OrgMatrix) => void;
    const inflightPromise = new Promise<OrgMatrix>((res) => {
      resolveLoad = res;
    });
    const loader = vi.fn().mockReturnValue(inflightPromise);
    _setLoader(loader);

    // Launch two concurrent getMatrix calls
    const p1 = getMatrix("org-e");
    const p2 = getMatrix("org-e");

    // Resolve the loader
    resolveLoad(makeMatrix("org-e"));

    const [m1, m2] = await Promise.all([p1, p2]);

    // Only one DB call despite two concurrent requests
    expect(loader).toHaveBeenCalledTimes(1);
    expect(m1).toBe(m2); // same object reference
  });

  it("(f) LRU cap 1000 drops oldest entry on overflow", async () => {
    const loader = vi.fn().mockImplementation((orgId: string) =>
      Promise.resolve(makeMatrix(orgId)),
    );
    _setLoader(loader);

    // Fill cache to capacity (1000 entries)
    for (let i = 0; i < 1000; i++) {
      await getMatrix(`org-lru-${i}`);
    }

    expect(loader).toHaveBeenCalledTimes(1000);

    // Adding org-lru-1000 should evict org-lru-0 (oldest loadedAt)
    await getMatrix("org-lru-1000");
    expect(loader).toHaveBeenCalledTimes(1001);

    // org-lru-0 was evicted so a new call should trigger a reload
    await getMatrix("org-lru-0");
    expect(loader).toHaveBeenCalledTimes(1002);
  });

  it("(g) _resetCache() clears all entries", async () => {
    const loader = vi.fn().mockImplementation((orgId: string) =>
      Promise.resolve(makeMatrix(orgId)),
    );
    _setLoader(loader);

    await getMatrix("org-g1");
    await getMatrix("org-g2");
    expect(loader).toHaveBeenCalledTimes(2);

    _resetCache();

    // Both should reload after reset
    await getMatrix("org-g1");
    await getMatrix("org-g2");
    expect(loader).toHaveBeenCalledTimes(4);
  });
});

describe("ensureOrgSeeded (D.6 completeness)", () => {
  beforeEach(() => {
    _resetCache();
    vi.clearAllMocks();
    mockedSeedOrgSystemRoles.mockResolvedValue(undefined);
  });

  it("(h) empty matrix → seeds org, revalidates cache, returns populated matrix", async () => {
    const emptyMatrix = makeMatrix("org-h");
    const populatedMatrix = makePopulatedMatrix("org-h");

    // loader returns empty on first call, populated on second (after revalidate)
    const loader = vi.fn()
      .mockResolvedValueOnce(emptyMatrix)
      .mockResolvedValueOnce(populatedMatrix);
    _setLoader(loader);

    const result = await ensureOrgSeeded("org-h");

    expect(mockedSeedOrgSystemRoles).toHaveBeenCalledWith("org-h");
    // Loader called twice: once for initial load, once after revalidate
    expect(loader).toHaveBeenCalledTimes(2);
    expect(result.roles.size).toBe(1); // the populated matrix has 1 role
  });

  it("(i) non-empty matrix → seeder NOT called, matrix returned as-is", async () => {
    const populatedMatrix = makePopulatedMatrix("org-i");
    const loader = vi.fn().mockResolvedValue(populatedMatrix);
    _setLoader(loader);

    const result = await ensureOrgSeeded("org-i");

    expect(mockedSeedOrgSystemRoles).not.toHaveBeenCalled();
    expect(result).toBe(populatedMatrix);
  });

  it("(j) seedOrgSystemRoles throws → ensureOrgSeeded propagates (fail-loud)", async () => {
    const emptyMatrix = makeMatrix("org-j");
    const loader = vi.fn().mockResolvedValue(emptyMatrix);
    _setLoader(loader);

    const seedError = new Error("DB connection failed");
    mockedSeedOrgSystemRoles.mockRejectedValue(seedError);

    await expect(ensureOrgSeeded("org-j")).rejects.toThrow(seedError);
  });
});
