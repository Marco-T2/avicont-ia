import "server-only";
import { prisma } from "@/lib/prisma";
import type { PrismaClient, Prisma } from "@/generated/prisma/client";

type OrgScope = { organizationId: string };

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
   *
   * `fn`'s param is typed `unknown` at this exposed signature so it
   * structurally satisfies domain ports (e.g. OrganizationsRepositoryPort)
   * that type their transaction callback opaquely to avoid dragging Prisma
   * into domain/ (R5). Internally it is cast back to
   * `Prisma.TransactionClient` before being handed to `$transaction`, since
   * this file is infrastructure and R5-exempt.
   */
  transaction<T>(
    fn: (tx: unknown) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<T> {
    return this.db.$transaction(
      fn as (tx: Prisma.TransactionClient) => Promise<T>,
      options,
    );
  }
}
