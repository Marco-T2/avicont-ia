import type { AgentRateLimitPort } from "../domain/ports/agent-rate-limit.port";

const DEFAULT_PER_USER = 60;
const DEFAULT_PER_ORG = 300;

export type RateLimitDecision =
  | { allowed: true }
  | {
      allowed: false;
      scope: "user" | "org";
      limit: number;
      retryAfterSeconds: number;
    };

function floorToHour(date: Date): Date {
  const out = new Date(date);
  out.setUTCMinutes(0, 0, 0);
  return out;
}

function secondsUntilNextHour(now: Date): number {
  const next = floorToHour(now);
  next.setUTCHours(next.getUTCHours() + 1);
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000));
}

async function parseLimit(envValue: string | undefined, fallback: number): Promise<number> {
  if (!envValue) return fallback;
  const n = Number(envValue);
  if (!Number.isFinite(n) || n <= 0) {
    const { logStructured } = await import("@/lib/logging/structured");
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
 * AgentRateLimitService — application layer service consuming AgentRateLimitPort.
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export class AgentRateLimitService {
  private readonly rateLimitPort: AgentRateLimitPort;
  private readonly env: Record<string, string | undefined>;

  constructor(
    rateLimitPort: AgentRateLimitPort,
    env: Record<string, string | undefined> = process.env,
  ) {
    this.rateLimitPort = rateLimitPort;
    this.env = env;
  }

  async perUserLimit(): Promise<number> {
    return parseLimit(this.env.AGENT_RATE_LIMIT_PER_USER, DEFAULT_PER_USER);
  }

  async perOrgLimit(): Promise<number> {
    return parseLimit(this.env.AGENT_RATE_LIMIT_PER_ORG, DEFAULT_PER_ORG);
  }

  /**
   * Delegates the decision to the injected AgentRateLimitPort.
   * Fail-open on error.
   */
  async check(
    organizationId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<RateLimitDecision> {
    try {
      const decision = await this.rateLimitPort.check(
        organizationId,
        userId,
        "agent",
      );
      if (decision.allowed) return { allowed: true };
      return {
        allowed: false,
        scope: "user",
        limit: await this.perUserLimit(),
        retryAfterSeconds: decision.retryAfterSeconds ?? secondsUntilNextHour(now),
      };
    } catch (err) {
      const { logStructured } = await import("@/lib/logging/structured");
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

  async record(
    organizationId: string,
    userId: string,
    mode: string,
    outcome: string,
  ): Promise<void> {
    try {
      await this.rateLimitPort.record(organizationId, userId, mode, outcome);
    } catch (err) {
      const { logStructured } = await import("@/lib/logging/structured");
      logStructured({
        event: "agent_rate_limit_record_failed",
        level: "warn",
        organizationId,
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
