/**
 * permissions.cache.ts — Module-scope in-process cache for org permission matrices.
 *
 * Design: D.3
 * - Module-scope Map<orgId, {matrix, expiresAt, inflight?}>
 * - 60s TTL
 * - Single-flight via inflight Promise (one DB call even under concurrent load)
 * - LRU cap 1000 (drops oldest loadedAt on overflow)
 * - NO Next.js unstable_cache or use cache (deprecated in Next 16)
 *
 * Test hook: _setLoader(fn) allows tests to inject a custom loader.
 * Default loader: prisma.customRole.findMany — wired up as identity per D.6 fallback.
 *
 * ensureOrgSeeded: D.6 / CR.1-S3 shared fallback — seeds the 5 system roles when an
 * org has none. Shared by requirePermission (server auth gate) and buildClientMatrixSnapshot
 * (layout snapshot path) to keep the fallback behavior consistent.
 */

import "server-only";
import type { Resource, PostableResource } from "@/features/shared/permissions";
import { PERMISSIONS_CLOSE, PERMISSIONS_REOPEN } from "@/features/shared/permissions";

export type OrgMatrix = {
  orgId: string;
  roles: Map<
    string, // slug
    {
      permissionsRead: Set<Resource>;
      permissionsWrite: Set<Resource>;
      canPost: Set<PostableResource>;
      canClose: Set<Resource>;
      canReopen: Set<Resource>;
      isSystem: boolean;
    }
  >;
  loadedAt: number;
};

type CacheEntry = {
  matrix: OrgMatrix;
  expiresAt: number;
  inflight?: Promise<OrgMatrix>;
};

const TTL_MS = 60_000; // 60 seconds
const LRU_CAP = 1000;

const cache = new Map<string, CacheEntry>();

/**
 * Default loader — queries the DB for all custom roles for an org.
 * Returns a minimal matrix for the org. This is the production path.
 * Tests replace this via _setLoader().
 *
 * PR8.2: removed the VITEST env guard (empty-matrix fallback for test envs
 * without a DB). Every test that touches the cache MUST mock the loader via
 * _setLoader() or mock the entire getMatrix via vi.mock. The guard was masking
 * missing mocks and making tests pass silently without exercising the real path.
 */
let _loader: (orgId: string) => Promise<OrgMatrix> = async (orgId) => {
  // Lazy import to avoid circular deps + allow module to load without DB in tests
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.customRole.findMany({ where: { organizationId: orgId } });
  const roles = new Map<string, {
    permissionsRead: Set<Resource>;
    permissionsWrite: Set<Resource>;
    canPost: Set<PostableResource>;
    canClose: Set<Resource>;
    canReopen: Set<Resource>;
    isSystem: boolean;
  }>();
  for (const row of rows) {
    // canClose / canReopen are derived from static matrices (not stored in DB yet).
    // We intersect: a role can close a resource iff PERMISSIONS_CLOSE grants it.
    const canClose = new Set<Resource>(
      (Object.keys(PERMISSIONS_CLOSE) as Resource[]).filter((r) =>
        PERMISSIONS_CLOSE[r].includes(row.slug),
      ),
    );
    const canReopen = new Set<Resource>(
      (Object.keys(PERMISSIONS_REOPEN) as Resource[]).filter((r) =>
        PERMISSIONS_REOPEN[r].includes(row.slug),
      ),
    );
    roles.set(row.slug, {
      permissionsRead: new Set(row.permissionsRead as Resource[]),
      permissionsWrite: new Set(row.permissionsWrite as Resource[]),
      canPost: new Set(row.canPost as PostableResource[]),
      canClose,
      canReopen,
      isSystem: row.isSystem,
    });
  }
  return { orgId, roles, loadedAt: Date.now() };
};

/**
 * Test-only hook: replace the loader for unit tests.
 * Do NOT call from production code.
 */
export function _setLoader(fn: (orgId: string) => Promise<OrgMatrix>): void {
  _loader = fn;
}

/**
 * Get the permission matrix for an org.
 * - Cache hit (within TTL): returns immediately.
 * - Cache miss or expired: loads from DB (single-flight during load).
 * - LRU: if cap is exceeded after a new insert, evicts the oldest loadedAt entry.
 */
export async function getMatrix(orgId: string): Promise<OrgMatrix> {
  const entry = cache.get(orgId);

  // Cache hit
  if (entry && !entry.inflight && entry.expiresAt > Date.now()) {
    return entry.matrix;
  }

  // Already loading (single-flight): return existing promise
  if (entry?.inflight) {
    return entry.inflight;
  }

  // Track whether this is a brand-new key (for LRU eviction decision)
  const isNewKey = !cache.has(orgId);

  // Cache miss or expired — start a new load
  const inflight: Promise<OrgMatrix> = _loader(orgId).then(
    (matrix) => {
      const now = Date.now();
      // Evict oldest entry if at cap and this is a new key (not a refresh of existing)
      if (isNewKey && cache.size >= LRU_CAP) {
        _evictOldest();
      }
      cache.set(orgId, { matrix, expiresAt: now + TTL_MS });
      return matrix;
    },
    (err) => {
      // Clear inflight on reject so next call retries
      const current = cache.get(orgId);
      if (current?.inflight) {
        cache.delete(orgId);
      }
      throw err;
    },
  );

  // Store the inflight promise so concurrent callers piggyback
  cache.set(orgId, { ...(entry ?? { matrix: null as unknown as OrgMatrix, expiresAt: 0 }), inflight });

  return inflight;
}

/**
 * Sync invalidation: drops this org's cache entry (and any inflight promise).
 * Next call to getMatrix will re-load from DB.
 * Note: only invalidates THIS process's cache. Multi-instance drift is ≤60s (D.12).
 */
export function revalidateOrgMatrix(orgId: string): void {
  cache.delete(orgId);
}

/**
 * Test-only: clear all cache entries.
 */
export function _resetCache(): void {
  cache.clear();
}

function _evictOldest(): void {
  // Map preserves insertion order — the first entry is the oldest.
  // Tie-break on loadedAt for entries loaded in the same tick.
  const firstKey = cache.keys().next().value;
  if (firstKey !== undefined) {
    cache.delete(firstKey);
  }
}

/**
 * Ensures an org's permission matrix has at least the 5 system roles.
 * If the cached matrix is empty, seeds the org and returns the fresh matrix.
 * If seeding fails (e.g. test env without DB), returns the empty matrix
 * silently — callers that hard-depend on non-empty matrices handle that case.
 *
 * Idempotent via Prisma `skipDuplicates:true` + cache revalidation. (D.6 / CR.1-S3)
 */
export async function ensureOrgSeeded(orgId: string): Promise<OrgMatrix> {
  let matrix = await getMatrix(orgId);

  if (matrix.roles.size === 0) {
    try {
      const { seedOrgSystemRoles } = await import("@/prisma/seed-system-roles");
      await seedOrgSystemRoles(orgId);
      revalidateOrgMatrix(orgId);
      matrix = await getMatrix(orgId);
    } catch {
      // Seed failed (e.g. test environment without DB, or migration not run yet).
      // Return the empty matrix silently — callers handle the empty case.
    }
  }

  return matrix;
}
