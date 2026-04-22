import type { Prisma } from "@/generated/prisma/client";

/**
 * Sets PostgreSQL session variables for audit trail triggers.
 * MUST be called within a transaction BEFORE any INSERT/UPDATE/DELETE
 * on dispatches, payments, or journal_entries.
 *
 * Uses SET LOCAL — variables are automatically cleared when the transaction ends.
 */
export async function setAuditContext(
  tx: Prisma.TransactionClient,
  userId: string,
  justification?: string,
  correlationId?: string,
): Promise<void> {
  await tx.$executeRawUnsafe(`SET LOCAL app.current_user_id = '${userId.replace(/'/g, "''")}'`);

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
