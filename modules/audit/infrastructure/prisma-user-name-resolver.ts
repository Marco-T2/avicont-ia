import "server-only";

import { prisma } from "@/lib/prisma";
import { type PrismaClient } from "@/generated/prisma/client";
import type { UserNameResolver } from "../application/audit.service";

type DbClient = Pick<PrismaClient, "user">;

export class PrismaUserNameResolver implements UserNameResolver {
  constructor(private readonly db: DbClient = prisma) {}

  async resolveNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const users = await this.db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    return new Map(users.map((u) => [u.id, u.name ?? u.email]));
  }
}
