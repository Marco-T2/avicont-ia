/**
 * Read-only RBAC port. Resolves whether `role` may execute the given action
 * (`scope`) inside `organizationId`. The adapter (C3) wraps the legacy
 * `@/features/permissions/server.canPost` matrix; the in-memory fake used by
 * application tests primes allowed (role, scope, organizationId) tuples
 * directly.
 *
 * NOT tx-aware — does NOT live inside the AccountingScope. Use cases resolve
 * permissions BEFORE entering `uow.run` so that a denied request never opens
 * a Postgres transaction (parity with legacy `journal.service.ts:199`, where
 * the `canPost` await runs above `withAuditTx`).
 */
export type PermissionScope = "journal";

export interface PermissionsPort {
  canPost(
    role: string,
    scope: PermissionScope,
    organizationId: string,
  ): Promise<boolean>;
}
