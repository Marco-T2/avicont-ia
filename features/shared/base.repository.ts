import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";

export type OrgScope = { organizationId: string };

export abstract class BaseRepository {
  constructor(protected readonly db: PrismaClient = prisma) {}

  protected requireOrg(organizationId: string): OrgScope {
    if (!organizationId) throw new Error("organizationId is required");
    return { organizationId };
  }

  /**
   * Exposes Prisma's interactive transaction so the service layer can
   * coordinate multiple repositories and services atomically. The optional
   * `options` argument is passed straight through to Prisma's `$transaction`
   * so long-running flows (e.g. monthly close) can widen the default timeout.
   */
  transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    return this.db.$transaction(fn, options);
  }
}
