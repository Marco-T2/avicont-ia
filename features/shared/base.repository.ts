import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

export type OrgScope = { organizationId: string };

export abstract class BaseRepository {
  constructor(protected readonly db: PrismaClient = prisma) {}

  protected requireOrg(organizationId: string): OrgScope {
    if (!organizationId) throw new Error("organizationId is required");
    return { organizationId };
  }
}
