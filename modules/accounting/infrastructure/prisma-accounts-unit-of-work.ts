import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

import type { AccountsUnitOfWork } from "../domain/ports/accounts-unit-of-work";

/**
 * Postgres-backed adapter for the accounts UnitOfWork port. Runs `fn` inside a
 * single `prisma.$transaction`, handing the opaque `tx` token (a
 * `Prisma.TransactionClient`) straight through — the port stays passthrough
 * (`tx: unknown`) and any narrowing happens downstream in the repo. Infra MAY
 * import Prisma; this keeps the atomic parent.isDetail-flip boundary out of the
 * application layer.
 */
export class PrismaAccountsUnitOfWork implements AccountsUnitOfWork {
  constructor(private readonly prisma: PrismaClient) {}

  async run<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => fn(tx));
  }
}
