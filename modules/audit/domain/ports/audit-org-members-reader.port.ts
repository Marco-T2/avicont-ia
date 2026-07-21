/**
 * Read port for the active organization members shown in the audit page user
 * filter select (audit-pure-read Group B). Owned by audit-hex because the read
 * exists solely for audit display (changedBy filter options); it is NOT a
 * general org-membership API. Declared here instead of the page querying
 * Prisma directly so the presentation layer stays decoupled from persistence
 * (R2 §3 ports-only) and the read is tenant-scoped.
 *
 * The view is a clean DTO — plain values only, NO Prisma types. The
 * member→view mapping (`user.name ?? user.email` display fallback) lives in
 * the infrastructure adapter (`PrismaAuditOrgMembersReaderAdapter`).
 */

export interface AuditOrgMemberView {
  id: string;
  name: string;
}

export interface AuditOrgMembersReaderPort {
  /**
   * Returns the active (non-deactivated) members of the organization as
   * {id, name} options ordered by user name. Cross-tenant reads resolve to an
   * empty list.
   */
  listActive(organizationId: string): Promise<AuditOrgMemberView[]>;
}
