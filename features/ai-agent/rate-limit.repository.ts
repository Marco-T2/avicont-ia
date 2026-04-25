import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";

/**
 * Floor a Date down to the hour. Per-hour buckets keyed on this value let us
 * use a single atomic UPSERT for the per-user counter and a SUM aggregation
 * for the per-org counter.
 */
export function floorToHour(date: Date): Date {
  const out = new Date(date);
  out.setUTCMinutes(0, 0, 0);
  return out;
}

export class AgentRateLimitRepository extends BaseRepository {
  /**
   * Atomic increment of the per-user counter for the given hour bucket.
   * Returns the new count. Single round-trip via UPSERT.
   */
  async incrementUser(
    organizationId: string,
    userId: string,
    windowStart: Date,
  ): Promise<number> {
    const row = await this.db.agentRateLimit.upsert({
      where: {
        organizationId_userId_windowStart: {
          organizationId,
          userId,
          windowStart,
        },
      },
      create: {
        organizationId,
        userId,
        windowStart,
        count: 1,
      },
      update: {
        count: { increment: 1 },
      },
      select: { count: true },
    });
    return row.count;
  }

  /**
   * Sum all per-user counters for the given org and hour bucket. Used to
   * enforce the per-organization limit after the per-user UPSERT.
   */
  async sumOrg(organizationId: string, windowStart: Date): Promise<number> {
    const result = await this.db.agentRateLimit.aggregate({
      where: { organizationId, windowStart },
      _sum: { count: true },
    });
    return result._sum.count ?? 0;
  }

  /**
   * Best-effort cleanup of expired buckets. Caller decides cadence (every Nth
   * request); this method does not throttle internally. Errors are not
   * propagated — cleanup is opportunistic.
   */
  async cleanupOlderThan(cutoff: Date): Promise<number> {
    const result = await this.db.agentRateLimit.deleteMany({
      where: { windowStart: { lt: cutoff } },
    });
    return result.count;
  }
}
