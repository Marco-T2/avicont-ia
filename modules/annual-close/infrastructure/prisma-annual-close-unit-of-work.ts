import "server-only";

import type {
  AnnualCloseScope,
  AnnualCloseUnitOfWork,
} from "../application/annual-close-unit-of-work";

import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

/**
 * Phase 4.13 STUB — UoW scaffolding so tsc + test imports resolve.
 */
export class PrismaAnnualCloseUnitOfWork implements AnnualCloseUnitOfWork {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly repo: UnitOfWorkRepoLike) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async run<T>(
    _ctx: AuditContext,
    _fn: (scope: AnnualCloseScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    throw new Error("STUB — Phase 4.14 GREEN pending");
  }
}
