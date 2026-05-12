import type { Prisma } from "@/generated/prisma/client";

/**
 * Sets PostgreSQL session variables for audit trail triggers.
 * MUST be called within a transaction BEFORE any INSERT/UPDATE/DELETE
 * on audited tables (dispatches, payments, journal_entries, sales, purchases,
 * sale_details, purchase_details, journal_lines).
 *
 * Variables set (all scoped to the current transaction via SET LOCAL):
 *   - app.current_user_id       — identity of the actor performing the change
 *   - app.current_organization_id — fallback for audit_trigger_fn when resolving
 *                                   organizationId on detail tables during CASCADE
 *                                   DELETE (parent row may already be gone)
 *   - app.audit_justification   — optional human-readable reason (required for
 *                                   LOCKED document mutations)
 *   - app.correlation_id        — optional UUID that groups all audit rows emitted
 *                                   by a single logical operation (e.g. close/reopen)
 *
 * Uses SET LOCAL — variables are automatically cleared when the transaction ends.
 */
export async function setAuditContext(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationId: string,
  justification?: string,
  correlationId?: string,
): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId.replace(/'/g, "''")}'`);
  await tx.$executeRawUnsafe(`SET LOCAL app.current_organization_id = '${organizationId.replace(/'/g, "''")}'`);

  if (justification) {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.audit_justification = '${justification.replace(/'/g, "''")}'`,
    );
  }

  if (correlationId) {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.correlation_id = '${correlationId.replace(/'/g, "''")}'`,
    );
  }
}
