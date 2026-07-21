import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AuditOrgMembersReaderPort,
  AuditOrgMemberView,
} from "@/modules/audit/domain/ports/audit-org-members-reader.port";

/**
 * Prisma directo adapter for `AuditOrgMembersReaderPort` (audit-pure-read
 * Group B). Mirror the legacy audit page `prisma.organizationMember.findMany`
 * query — tenant-scoped `{ organizationId, deactivatedAt: null }` where — and
 * absorb the `user.name ?? user.email` display fallback so the page receives
 * clean `{id, name}` views (no Prisma types leak).
 *
 * Constructor flexible: `db = prisma` default — paridad con
 * `PrismaAuditRepository` / `PrismaUserNameResolver`.
 */

type DbClient = Pick<PrismaClient, "organizationMember">;

export class PrismaAuditOrgMembersReaderAdapter
  implements AuditOrgMembersReaderPort
{
  constructor(private readonly db: DbClient = prisma) {}

  async listActive(organizationId: string): Promise<AuditOrgMemberView[]> {
    const members = await this.db.organizationMember.findMany({
      where: { organizationId, deactivatedAt: null },
      select: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { user: { name: "asc" } },
    });

    return members.map((m) => ({
      id: m.user.id,
      name: m.user.name ?? m.user.email,
    }));
  }
}
