import { Prisma } from "@/generated/prisma/client";

/**
 * True iff `err` is a Prisma unique-constraint violation (P2002). When
 * `targetIndex` is provided, also asserts the violation is on that specific
 * compound index (Prisma surfaces the index name via `err.meta.target`).
 *
 * Used by optimistic-retry loops (e.g. JournalRepository.createWithRetryTx)
 * to distinguish "another tx beat us to this number" from real errors.
 */
export function isPrismaUniqueViolation(
  err: unknown,
  targetIndex?: string,
): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (err.code !== "P2002") return false;
  if (!targetIndex) return true;

  const target = err.meta?.target ?? "";
  if (Array.isArray(target)) {
    return target.join("_") === targetIndex || target.includes(targetIndex);
  }
  return target === targetIndex;
}
