import "server-only";
import { AuditService } from "../application/audit.service";
import { PrismaAuditRepository } from "../infrastructure/prisma-audit.repository";
import { PrismaUserNameResolver } from "../infrastructure/prisma-user-name-resolver";

export function makeAuditService(): AuditService {
  return new AuditService(
    new PrismaAuditRepository(),
    new PrismaUserNameResolver(),
  );
}
