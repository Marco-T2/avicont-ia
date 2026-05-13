import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import type {
  AgentRateLimitPort,
  RateLimitDecision,
} from "../../domain/ports/agent-rate-limit.port";

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

const DEFAULT_PER_USER = 60;
const DEFAULT_PER_ORG = 300;

function parseLimit(envValue: string | undefined, fallback: number): number {
  if (!envValue) return fallback;
  const n = Number(envValue);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function secondsUntilNextHour(now: Date): number {
  const next = floorToHour(now);
  next.setUTCHours(next.getUTCHours() + 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

/**
 * PrismaRateLimitRepository — implements AgentRateLimitPort.
 * Renamed from features/ai-agent/rate-limit.repository.ts.
 *
 * The port surface (check/record) is decision-oriented — the legacy methods
 * (incrementUser/sumOrg/cleanupOlderThan) are still callable internally but
 * the application layer consumes only the port-shaped interface.
 */
export class PrismaRateLimitRepository
  extends BaseRepository
  implements AgentRateLimitPort
{
  /**
   * Check whether the (org, user) pair is allowed at this moment. Atomic
   * per-user UPSERT followed by per-org SUM. On limit-exceeded returns an
   * `allowed: false` decision with `retryAfterSeconds` until the next bucket.
   */
  async check(
    orgId: string,
    userId: string,
    _mode: string,
  ): Promise<RateLimitDecision> {
    const now = new Date();
    const windowStart = floorToHour(now);
    const perUser = parseLimit(process.env.AGENT_RATE_LIMIT_PER_USER, DEFAULT_PER_USER);
    const perOrg = parseLimit(process.env.AGENT_RATE_LIMIT_PER_ORG, DEFAULT_PER_ORG);

    const userRow = await this.db.agentRateLimit.upsert({
      where: {
        organizationId_userId_windowStart: {
          organizationId: orgId,
          userId,
          windowStart,
        },
      },
      create: { organizationId: orgId, userId, windowStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });

    if (userRow.count > perUser) {
      return {
        allowed: false,
        reason: "per-user limit exceeded",
        retryAfterSeconds: secondsUntilNextHour(now),
      };
    }

    const orgAgg = await this.db.agentRateLimit.aggregate({
      where: { organizationId: orgId, windowStart },
      _sum: { count: true },
    });
    const orgCount = orgAgg._sum.count ?? 0;

    if (orgCount > perOrg) {
      return {
        allowed: false,
        reason: "per-org limit exceeded",
        retryAfterSeconds: secondsUntilNextHour(now),
      };
    }

    return { allowed: true };
  }

  /**
   * No-op for this Prisma adapter — check() already increments the bucket
   * atomically, so a separate record() call would double-count. Kept on the
   * port surface for adapters that decouple decision from accounting.
   */
  async record(
    _orgId: string,
    _userId: string,
    _mode: string,
    _outcome: string,
  ): Promise<void> {
    // intentional no-op
  }

  /**
   * Best-effort cleanup of expired buckets. Caller decides cadence.
   */
  async cleanupOlderThan(cutoff: Date): Promise<number> {
    const result = await this.db.agentRateLimit.deleteMany({
      where: { windowStart: { lt: cutoff } },
    });
    return result.count;
  }
}
