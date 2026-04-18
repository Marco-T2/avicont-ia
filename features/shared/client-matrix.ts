/**
 * client-matrix.ts — Server-side helper that builds a serializable
 * ClientMatrixSnapshot from the cached OrgMatrix for a given (orgId, role).
 *
 * Design: D.3, D.8, Option B for PR7.1 — fetch the matrix in the dashboard
 * Server Component layout and pass it as a prop to the
 * <RolesMatrixProvider>. No client-side fetch, no loading flash.
 *
 * The snapshot contains only the CALLER's row — not the full per-role
 * matrix. The full matrix lives in the cache and is reachable via the admin
 * CRUD API; gating on the client only needs the caller's row.
 */
import { ensureOrgSeeded } from "./permissions.cache";

export type ClientMatrixSnapshot = {
  orgId: string;
  role: string;
  permissionsRead: string[];
  permissionsWrite: string[];
  canPost: string[];
};

/**
 * Build a JSON-serializable snapshot of the caller's row in the org matrix.
 *
 * Returns `null` when the role is not present in the matrix (stale cache,
 * deleted custom role, etc.). Callers pass the result as-is to the
 * <RolesMatrixProvider> — `null` triggers the "deny by default" path on the
 * client, which is the safe behavior.
 *
 * Arrays are NOT sorted here — the service layer already normalizes on
 * write (D.11) — this helper simply spreads into plain arrays so Sets don't
 * cross the RSC boundary (they would throw on serialization).
 */
export async function buildClientMatrixSnapshot(
  orgId: string,
  role: string,
): Promise<ClientMatrixSnapshot | null> {
  const matrix = await ensureOrgSeeded(orgId);
  const row = matrix.roles.get(role);
  if (!row) return null;
  return {
    orgId,
    role,
    permissionsRead: [...row.permissionsRead],
    permissionsWrite: [...row.permissionsWrite],
    canPost: [...row.canPost],
  };
}
