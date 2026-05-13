/**
 * Outbound port for agent rate-limit checks and recording.
 * Domain layer: no server-only, no Prisma runtime, no SDK deps.
 */

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; reason: string; retryAfterSeconds?: number };

/**
 * AgentRateLimitPort — check and record invocation.
 */
export interface AgentRateLimitPort {
  check(orgId: string, userId: string, mode: string): Promise<RateLimitDecision>;
  record(orgId: string, userId: string, mode: string, outcome: string): Promise<void>;
}
