/**
 * Integration tests for AgentRateLimitRepository against the real database.
 * Mirrors the pattern in memory.repository.test.ts: real Prisma, ephemeral
 * org/user fixtures, manual cleanup in afterAll.
 *
 * What we cover:
 *   1. incrementUser: atomic UPSERT — first call inserts, subsequent calls
 *      increment, returns the running count.
 *   2. sumOrg: aggregates across all per-user rows in the same window.
 *   3. cleanupOlderThan: deletes only rows older than the cutoff.
 *   4. Cross-tenant isolation: increments in org A don't affect org B's
 *      counters or sums (the unique key is composite on organizationId).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  AgentRateLimitRepository,
  floorToHour,
} from "../rate-limit.repository";

const repo = new AgentRateLimitRepository();

let orgAId: string;
let orgBId: string;
let userAId: string;
let userBId: string;

const STAMP = Date.now();
const NOW = floorToHour(new Date());
const PAST = new Date(NOW.getTime() - 30 * 60 * 60 * 1000); // 30h ago

beforeAll(async () => {
  const userA = await prisma.user.create({
    data: {
      clerkUserId: `test-user-rl-a-${STAMP}`,
      email: `rl-a-${STAMP}@test.com`,
      name: "Rate Limit Test User A",
    },
  });
  userAId = userA.id;

  const userB = await prisma.user.create({
    data: {
      clerkUserId: `test-user-rl-b-${STAMP}`,
      email: `rl-b-${STAMP}@test.com`,
      name: "Rate Limit Test User B",
    },
  });
  userBId = userB.id;

  const orgA = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-rl-a-${STAMP}`,
      name: "Rate Limit Org A",
      slug: `test-org-rl-a-${STAMP}`,
    },
  });
  orgAId = orgA.id;

  const orgB = await prisma.organization.create({
    data: {
      clerkOrgId: `test-org-rl-b-${STAMP}`,
      name: "Rate Limit Org B",
      slug: `test-org-rl-b-${STAMP}`,
    },
  });
  orgBId = orgB.id;
});

afterAll(async () => {
  await prisma.agentRateLimit.deleteMany({
    where: { organizationId: { in: [orgAId, orgBId] } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [orgAId, orgBId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [userAId, userBId] } },
  });
  await prisma.$disconnect();
});

describe("AgentRateLimitRepository — increment + aggregate", () => {
  it("incrementUser inserts on first call, increments on subsequent calls", async () => {
    const first = await repo.incrementUser(orgAId, userAId, NOW);
    const second = await repo.incrementUser(orgAId, userAId, NOW);
    const third = await repo.incrementUser(orgAId, userAId, NOW);

    expect(first).toBe(1);
    expect(second).toBe(2);
    expect(third).toBe(3);
  });

  it("sumOrg aggregates counts across all users in the same window", async () => {
    // Ensure userA has 3 from the previous test (idempotent if it ran first;
    // otherwise we add to the running count in this beforeAll-shared org).
    // Now add 5 increments from userB.
    for (let i = 0; i < 5; i++) {
      await repo.incrementUser(orgAId, userBId, NOW);
    }

    const sum = await repo.sumOrg(orgAId, NOW);

    // userA had 3 from the prior test, userB has 5 → 8 total in this window.
    expect(sum).toBeGreaterThanOrEqual(8);
  });
});

describe("AgentRateLimitRepository — cross-tenant isolation", () => {
  it("incrementing org A does not affect org B's counters", async () => {
    const aBefore = await repo.sumOrg(orgAId, NOW);
    const bBefore = await repo.sumOrg(orgBId, NOW);

    await repo.incrementUser(orgAId, userAId, NOW);

    const aAfter = await repo.sumOrg(orgAId, NOW);
    const bAfter = await repo.sumOrg(orgBId, NOW);

    expect(aAfter).toBe(aBefore + 1);
    expect(bAfter).toBe(bBefore);
  });

  it("the same userId across two orgs is tracked separately", async () => {
    // userA is independent in each org because the unique key is
    // (organizationId, userId, windowStart).
    const aCount = await repo.incrementUser(orgAId, userAId, NOW);
    const bCount = await repo.incrementUser(orgBId, userAId, NOW);

    expect(bCount).toBe(1); // org B starts fresh
    expect(aCount).toBeGreaterThanOrEqual(1); // org A had prior increments
  });
});

describe("AgentRateLimitRepository — cleanup", () => {
  it("cleanupOlderThan removes only buckets older than the cutoff", async () => {
    // Seed an old bucket directly so we can assert it gets removed.
    await prisma.agentRateLimit.create({
      data: {
        organizationId: orgAId,
        userId: userAId,
        windowStart: PAST,
        count: 7,
      },
    });

    // 24h cutoff: PAST is 30h old → should be deleted; NOW is 0h old → kept.
    const cutoff = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);
    const deleted = await repo.cleanupOlderThan(cutoff);

    expect(deleted).toBeGreaterThanOrEqual(1);

    const survivors = await prisma.agentRateLimit.findMany({
      where: { organizationId: orgAId, windowStart: PAST },
    });
    expect(survivors).toHaveLength(0);

    // Current-window rows must still be there.
    const current = await prisma.agentRateLimit.findMany({
      where: { organizationId: orgAId, windowStart: NOW },
    });
    expect(current.length).toBeGreaterThan(0);
  });
});
