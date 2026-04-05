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
   * coordinate multiple repositories and services atomically.
   */
  transaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(fn);
  }
}
