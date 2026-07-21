/**
 * Read port for the audit rows of a single close/reopen event as consumed by
 * the monthly-close close-event page and the monthly-close audit-trail API
 * route (audit-pure-read Group B). Audit-hex declares this port instead of the
 * consumers querying Prisma directly so the presentation layer stays decoupled
 * from persistence (R2 §3 ports-only) and the read is tenant-scoped.
 *
 * The view is a clean DTO — plain values only, NO Prisma types (`Json?`
 * columns arrive coerced to `Record<string, unknown> | null`, paridad
 * `AuditRow`). The Prisma projection→view conversion lives in the
 * infrastructure adapter (`PrismaAuditCloseEventReaderAdapter`).
 */

export interface AuditCloseEventView {
  id: string;
  organizationId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedById: string | null;
  justification: string | null;
  correlationId: string | null;
  createdAt: Date;
}

export interface AuditCloseEventReaderPort {
  /**
   * Returns the audit rows emitted by a single close/reopen operation
   * (grouped by `correlationId`), ordered by entityType then createdAt.
   * Cross-tenant reads resolve to an empty list.
   */
  listByCorrelation(
    organizationId: string,
    correlationId: string,
  ): Promise<AuditCloseEventView[]>;
}
