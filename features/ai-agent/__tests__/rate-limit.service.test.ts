/**
 * Unit tests for AgentRateLimitService — env parsing, scope rejection logic,
 * and fail-open behavior. Uses a stub repo so this is fast and DB-free; the
 * real Postgres path is covered by rate-limit.repository.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentRateLimitService } from "../rate-limit.service";
import { logStructured } from "@/lib/logging/structured";
import type { AgentRateLimitRepository } from "../rate-limit.repository";

vi.mock("@/lib/logging/structured", () => ({
  logStructured: vi.fn(),
}));

type StubRepo = Pick<
  AgentRateLimitRepository,
  "incrementUser" | "sumOrg" | "cleanupOlderThan"
>;

function makeRepo(overrides: Partial<StubRepo> = {}): AgentRateLimitRepository {
  const defaults: StubRepo = {
    incrementUser: vi.fn().mockResolvedValue(1),
    sumOrg: vi.fn().mockResolvedValue(1),
    cleanupOlderThan: vi.fn().mockResolvedValue(0),
  };
  return { ...defaults, ...overrides } as AgentRateLimitRepository;
}

const ORG = "org_1";
const USER = "user_1";

beforeEach(() => {
  vi.mocked(logStructured).mockClear();
  AgentRateLimitService.__resetCleanupCounterForTests();
});

describe("AgentRateLimitService — env parsing", () => {
  it("uses defaults when env vars are unset", () => {
    const svc = new AgentRateLimitService(makeRepo(), {});
    expect(svc.perUserLimit()).toBe(60);
    expect(svc.perOrgLimit()).toBe(300);
  });

  it("respects valid numeric env vars", () => {
    const svc = new AgentRateLimitService(makeRepo(), {
      AGENT_RATE_LIMIT_PER_USER: "10",
      AGENT_RATE_LIMIT_PER_ORG: "50",
    });
    expect(svc.perUserLimit()).toBe(10);
    expect(svc.perOrgLimit()).toBe(50);
  });

  it("falls back to default and logs warning on invalid env", () => {
    const svc = new AgentRateLimitService(makeRepo(), {
      AGENT_RATE_LIMIT_PER_USER: "abc",
      AGENT_RATE_LIMIT_PER_ORG: "-5",
    });
    expect(svc.perUserLimit()).toBe(60);
    expect(svc.perOrgLimit()).toBe(300);
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "agent_rate_limit_invalid_env",
        level: "warn",
        raw: "abc",
        fallback: 60,
      }),
    );
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "agent_rate_limit_invalid_env",
        raw: "-5",
        fallback: 300,
      }),
    );
  });
});

describe("AgentRateLimitService — check decisions", () => {
  it("allows when user count <= limit and org sum <= limit", async () => {
    const repo = makeRepo({
      incrementUser: vi.fn().mockResolvedValue(5),
      sumOrg: vi.fn().mockResolvedValue(20),
    });
    const svc = new AgentRateLimitService(repo, {
      AGENT_RATE_LIMIT_PER_USER: "60",
      AGENT_RATE_LIMIT_PER_ORG: "300",
    });

    const decision = await svc.check(ORG, USER);

    expect(decision).toEqual({ allowed: true });
  });

  it("rejects with scope=user when user counter exceeds the user limit", async () => {
    const repo = makeRepo({
      incrementUser: vi.fn().mockResolvedValue(11), // over limit of 10
      sumOrg: vi.fn().mockResolvedValue(11),
    });
    const svc = new AgentRateLimitService(repo, {
      AGENT_RATE_LIMIT_PER_USER: "10",
      AGENT_RATE_LIMIT_PER_ORG: "300",
    });

    const decision = await svc.check(ORG, USER);

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.scope).toBe("user");
      expect(decision.limit).toBe(10);
      expect(decision.retryAfterSeconds).toBeGreaterThan(0);
      expect(decision.retryAfterSeconds).toBeLessThanOrEqual(3600);
    }
    // sumOrg should NOT have been queried — short-circuit on user limit.
    expect(repo.sumOrg).not.toHaveBeenCalled();
  });

  it("rejects with scope=org when user is fine but org sum exceeds", async () => {
    const repo = makeRepo({
      incrementUser: vi.fn().mockResolvedValue(2),
      sumOrg: vi.fn().mockResolvedValue(301),
    });
    const svc = new AgentRateLimitService(repo, {
      AGENT_RATE_LIMIT_PER_USER: "60",
      AGENT_RATE_LIMIT_PER_ORG: "300",
    });

    const decision = await svc.check(ORG, USER);

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.scope).toBe("org");
      expect(decision.limit).toBe(300);
    }
  });

  it("uses bucket-aligned retryAfter (seconds until next hour)", async () => {
    const repo = makeRepo({
      incrementUser: vi.fn().mockResolvedValue(99),
    });
    const svc = new AgentRateLimitService(repo, {
      AGENT_RATE_LIMIT_PER_USER: "10",
    });

    // Force a known clock: 13:42:30 UTC → next bucket at 14:00:00 → 17m30s = 1050s
    const decision = await svc.check(
      ORG,
      USER,
      new Date("2026-04-25T13:42:30Z"),
    );

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.retryAfterSeconds).toBe(1050);
    }
  });
});

describe("AgentRateLimitService — fail-open on DB error", () => {
  it("allows the request and logs when incrementUser throws", async () => {
    const repo = makeRepo({
      incrementUser: vi.fn().mockRejectedValue(new Error("DB down")),
    });
    const svc = new AgentRateLimitService(repo);

    const decision = await svc.check(ORG, USER);

    expect(decision).toEqual({ allowed: true });
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "agent_rate_limit_check_failed",
        level: "warn",
        organizationId: ORG,
        userId: USER,
        error: "DB down",
      }),
    );
  });

  it("allows the request when sumOrg throws after a successful increment", async () => {
    const repo = makeRepo({
      incrementUser: vi.fn().mockResolvedValue(2),
      sumOrg: vi.fn().mockRejectedValue(new Error("query timeout")),
    });
    const svc = new AgentRateLimitService(repo);

    const decision = await svc.check(ORG, USER);

    expect(decision).toEqual({ allowed: true });
    expect(logStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "agent_rate_limit_check_failed",
        error: "query timeout",
      }),
    );
  });
});

describe("AgentRateLimitService — cleanup amortization", () => {
  it("does not call cleanup on every request", async () => {
    const cleanup = vi.fn().mockResolvedValue(0);
    const repo = makeRepo({
      incrementUser: vi.fn().mockResolvedValue(1),
      sumOrg: vi.fn().mockResolvedValue(1),
      cleanupOlderThan: cleanup,
    });
    const svc = new AgentRateLimitService(repo);

    for (let i = 0; i < 50; i++) {
      await svc.check(ORG, USER);
    }
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("triggers cleanup once after 100 requests, with a 24h-old cutoff", async () => {
    const cleanup = vi.fn().mockResolvedValue(0);
    const repo = makeRepo({
      incrementUser: vi.fn().mockResolvedValue(1),
      sumOrg: vi.fn().mockResolvedValue(1),
      cleanupOlderThan: cleanup,
    });
    const svc = new AgentRateLimitService(repo);

    const fixedNow = new Date("2026-04-25T13:00:00Z");
    for (let i = 0; i < 100; i++) {
      await svc.check(ORG, USER, fixedNow);
    }

    // cleanup is fire-and-forget; let any microtasks settle.
    await new Promise((r) => setTimeout(r, 10));

    expect(cleanup).toHaveBeenCalledTimes(1);
    const cutoff = cleanup.mock.calls[0][0] as Date;
    const expectedCutoff = new Date("2026-04-24T13:00:00Z");
    expect(cutoff.toISOString()).toBe(expectedCutoff.toISOString());
  });
});
