import "server-only";
import type { AuditCloseEventReaderPort } from "../domain/ports/audit-close-event-reader.port";
import type { AuditOrgMembersReaderPort } from "../domain/ports/audit-org-members-reader.port";
import { AuditService } from "../application/audit.service";
import { PrismaAuditCloseEventReaderAdapter } from "../infrastructure/prisma-audit-close-event-reader.adapter";
import { PrismaAuditOrgMembersReaderAdapter } from "../infrastructure/prisma-audit-org-members-reader.adapter";
import { PrismaAuditRepository } from "../infrastructure/prisma-audit.repository";
import { PrismaUserNameResolver } from "../infrastructure/prisma-user-name-resolver";

export function makeAuditService(): AuditService {
  return new AuditService(
    new PrismaAuditRepository(),
    new PrismaUserNameResolver(),
  );
}

/**
 * Read facade for audit external deps (audit-pure-read Group B) — groups the
 * tenant-scoped read ports the audit page, the monthly-close close-event page
 * and the monthly-close audit-trail route consume instead of querying Prisma
 * directly. Wiring lives here (único archivo bajo `presentation/` autorizado a
 * importar de `infrastructure/` — architecture.md R4 carve-out). Mirror
 * `makeSaleReads()` in the sale composition-root (sale-pure-read pilot).
 */
export interface AuditReads {
  closeEvents: AuditCloseEventReaderPort;
  orgMembers: AuditOrgMembersReaderPort;
}

export function makeAuditReads(): AuditReads {
  return {
    closeEvents: new PrismaAuditCloseEventReaderAdapter(),
    orgMembers: new PrismaAuditOrgMembersReaderAdapter(),
  };
}
