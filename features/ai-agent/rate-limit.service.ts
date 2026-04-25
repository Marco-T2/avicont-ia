import "server-only";
import { logStructured } from "@/lib/logging/structured";
import {
  AgentRateLimitRepository,
  floorToHour,
} from "./rate-limit.repository";

const DEFAULT_PER_USER = 60;
const DEFAULT_PER_ORG = 300;
const CLEANUP_EVERY_N_REQUESTS = 100;
const CLEANUP_RETENTION_HOURS = 24;

export type RateLimitDecision =
  | { allowed: true }
  | {
      allowed: false;
      scope: "user" | "org";
      limit: number;
      retryAfterSeconds: number;
    };

function parseLimit(envValue: string | undefined, fallback: number): number {
  if (!envValue) return fallback;
  const n = Number(envValue);
  if (!Number.isFinite(n) || n <= 0) {
    logStructured({
      event: "agent_rate_limit_invalid_env",
      level: "warn",
      raw: envValue,
      fallback,
    });
    return fallback;
  }
  return Math.floor(n);
}

/**
 * Seconds until the next hour boundary — what to send back as Retry-After
 * when the limit is hit. Uses the bucket-aligned semantics: a 1-hour window
 * resets at the next floor(now+1h, hour).
 */
function secondsUntilNextHour(now: Date): number {
  const next = floorToHour(now);
  next.setUTCHours(next.getUTCHours() + 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

export class AgentRateLimitService {
  // Module-scoped cleanup counter so the sweep cost is amortized across
  // many requests instead of running on every check or needing a cron.
  private static requestsSinceCleanup = 0;

  constructor(
    private readonly repo: AgentRateLimitRepository = new AgentRateLimitRepository(),
    // Loose record type so tests can pass a literal `{}` without satisfying
    // the full NodeJS.ProcessEnv shape (which insists on NODE_ENV being set).
    private readonly env: Record<string, string | undefined> = process.env,
  ) {}

  perUserLimit(): number {
    return parseLimit(this.env.AGENT_RATE_LIMIT_PER_USER, DEFAULT_PER_USER);
  }

  perOrgLimit(): number {
    return parseLimit(this.env.AGENT_RATE_LIMIT_PER_ORG, DEFAULT_PER_ORG);
  }

  /**
   * Atomically increments the per-user counter, then aggregates the per-org
   * counter for the current hour bucket. The first limit exceeded wins.
   *
   * Fail-open: any DB error is logged and the request is allowed through.
   * The agent feature is non-critical relative to the accounting core; a
   * rate-limit outage must not take down the chat endpoint. The structured
   * log fires so the failure is visible in stdout aggregation.
   */
  async check(
    organizationId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<RateLimitDecision> {
    const userLimit = this.perUserLimit();
    const orgLimit = this.perOrgLimit();
    const windowStart = floorToHour(now);

    try {
      const userCount = await this.repo.incrementUser(
        organizationId,
        userId,
        windowStart,
      );

      this.maybeCleanup(now);

      if (userCount > userLimit) {
        return {
          allowed: false,
          scope: "user",
          limit: userLimit,
          retryAfterSeconds: secondsUntilNextHour(now),
        };
      }

      const orgCount = await this.repo.sumOrg(organizationId, windowStart);
      if (orgCount > orgLimit) {
        return {
          allowed: false,
          scope: "org",
          limit: orgLimit,
          retryAfterSeconds: secondsUntilNextHour(now),
        };
      }

      return { allowed: true };
    } catch (err) {
      // Fail-open: log and let the request through.
      logStructured({
        event: "agent_rate_limit_check_failed",
        level: "warn",
        organizationId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { allowed: true };
    }
  }

  /**
   * Fire-and-forget sweep of expired buckets. Runs at most every Nth request,
   * never blocks the caller, and swallows its own errors.
   */
  private maybeCleanup(now: Date): void {
    AgentRateLimitService.requestsSinceCleanup += 1;
    if (
      AgentRateLimitService.requestsSinceCleanup < CLEANUP_EVERY_N_REQUESTS
    ) {
      return;
    }
    AgentRateLimitService.requestsSinceCleanup = 0;

    const cutoff = new Date(now);
    cutoff.setUTCHours(cutoff.getUTCHours() - CLEANUP_RETENTION_HOURS);

    void this.repo.cleanupOlderThan(cutoff).catch((err) => {
      logStructured({
        event: "agent_rate_limit_cleanup_failed",
        level: "warn",
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /** Test seam: reset the in-process cleanup counter. */
  static __resetCleanupCounterForTests(): void {
    AgentRateLimitService.requestsSinceCleanup = 0;
  }
}
