/**
 * Cross-user isolation tests for AgentContextRepository.
 *
 * Regression guard for the privacy leak where buildSocioContext ignored
 * userId — a `member` socio could see every farm/lot/expense in the org via
 * the agent's structured context, not just their own.
 *
 * Strategy: real DB, two members of the same organization each owning one
 * farm with one active lot and one expense. The filter MUST scope the data
 * by memberId; the unfiltered queries (admin/owner path) MUST still return
 * everything.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { AgentContextRepository } from "../agent-context.repository";

const repo = new AgentContextRepository();

const STAMP = Date.now();

let orgId: string;
let userAId: string;
let userBId: string;
let memberAId: string;
let memberBId: string;
let farmAId: string;
let farmBId: string;
let lotAId: string;
let lotBId: string;

beforeAll(async () => {
  const userA = await prisma.user.create({
    data: {
      clerkUserId: `test-ctx-userA-${STAMP}`,
      email: `ctxA-${STAMP}@test.com`,
      name: "Context A",
    },
  });
  userAId = userA.id;

  const userB = await prisma.user.create({
    data: {
      clerkUserId: `test-ctx-userB-${STAMP}`,
      email: `ctxB-${STAMP}@test.com`,
      name: "Context B",
    },
  });
  userBId = userB.id;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `test-ctx-org-${STAMP}`,
      name: "Context Test Org",
      slug: `test-ctx-org-${STAMP}`,
    },
  });
  orgId = org.id;

  const memberA = await prisma.organizationMember.create({
    data: { organizationId: orgId, userId: userAId, role: "member" },
  });
  memberAId = memberA.id;

  const memberB = await prisma.organizationMember.create({
    data: { organizationId: orgId, userId: userBId, role: "member" },
  });
  memberBId = memberB.id;

  const farmA = await prisma.farm.create({
    data: {
      name: "Granja A",
      organizationId: orgId,
      memberId: memberAId,
    },
  });
  farmAId = farmA.id;

  const farmB = await prisma.farm.create({
    data: {
      name: "Granja B",
      organizationId: orgId,
      memberId: memberBId,
    },
  });
  farmBId = farmB.id;

  const lotA = await prisma.chickenLot.create({
    data: {
      name: "Lote A1",
      barnNumber: 1,
      initialCount: 1000,
      startDate: new Date(),
      status: "ACTIVE",
      farmId: farmAId,
      organizationId: orgId,
    },
  });
  lotAId = lotA.id;

  const lotB = await prisma.chickenLot.create({
    data: {
      name: "Lote B1",
      barnNumber: 1,
      initialCount: 2000,
      startDate: new Date(),
      status: "ACTIVE",
      farmId: farmBId,
      organizationId: orgId,
    },
  });
  lotBId = lotB.id;

  await prisma.expense.create({
    data: {
      amount: "100.00",
      category: "ALIMENTO",
      date: new Date(),
      lotId: lotAId,
      organizationId: orgId,
      createdById: userAId,
    },
  });
  await prisma.expense.create({
    data: {
      amount: "200.00",
      category: "MEDICAMENTOS",
      date: new Date(),
      lotId: lotBId,
      organizationId: orgId,
      createdById: userBId,
    },
  });
});

afterAll(async () => {
  await prisma.expense.deleteMany({ where: { organizationId: orgId } });
  await prisma.chickenLot.deleteMany({ where: { organizationId: orgId } });
  await prisma.farm.deleteMany({ where: { organizationId: orgId } });
  await prisma.organizationMember.deleteMany({
    where: { organizationId: orgId },
  });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.user.deleteMany({
    where: { id: { in: [userAId, userBId] } },
  });
  await prisma.$disconnect();
});

describe("AgentContextRepository — findMemberIdByUserId", () => {
  it("resolves the active membership id for a (org, user) pair", async () => {
    const id = await repo.findMemberIdByUserId(orgId, userAId);
    expect(id).toBe(memberAId);
  });

  it("returns null for a user who has no membership in the org", async () => {
    // userBId is a real user, but querying it against a fresh org with no
    // membership (we use orgId + a fake user) is the canonical case. Using
    // a non-existent user clerk-id-shaped string suffices.
    const id = await repo.findMemberIdByUserId(orgId, "user_does_not_exist");
    expect(id).toBeNull();
  });

  it("returns null for a deactivated member", async () => {
    // Deactivate B, assert it disappears from the resolver, then reactivate.
    await prisma.organizationMember.update({
      where: { id: memberBId },
      data: { deactivatedAt: new Date() },
    });
    try {
      const id = await repo.findMemberIdByUserId(orgId, userBId);
      expect(id).toBeNull();
    } finally {
      await prisma.organizationMember.update({
        where: { id: memberBId },
        data: { deactivatedAt: null },
      });
    }
  });
});

describe("AgentContextRepository — findFarmsWithActiveLots filter", () => {
  it("returns only the requested member's farms when memberId is passed", async () => {
    const aOnly = await repo.findFarmsWithActiveLots(orgId, memberAId);
    expect(aOnly.map((f) => f.name)).toEqual(["Granja A"]);
    expect(aOnly[0].lots.map((l) => l.name)).toEqual(["Lote A1"]);

    const bOnly = await repo.findFarmsWithActiveLots(orgId, memberBId);
    expect(bOnly.map((f) => f.name)).toEqual(["Granja B"]);
    expect(bOnly[0].lots.map((l) => l.name)).toEqual(["Lote B1"]);
  });

  it("returns all farms in the org when memberId is omitted (admin/owner path)", async () => {
    const all = await repo.findFarmsWithActiveLots(orgId);
    const names = all.map((f) => f.name).sort();
    expect(names).toEqual(["Granja A", "Granja B"]);
  });
});

describe("AgentContextRepository — findRecentExpenses filter", () => {
  it("returns only expenses tied to the member's farms when memberId is passed", async () => {
    const aOnly = await repo.findRecentExpenses(orgId, 10, memberAId);
    expect(aOnly).toHaveLength(1);
    expect(aOnly[0].lot.name).toBe("Lote A1");
    expect(aOnly[0].category).toBe("ALIMENTO");

    const bOnly = await repo.findRecentExpenses(orgId, 10, memberBId);
    expect(bOnly).toHaveLength(1);
    expect(bOnly[0].lot.name).toBe("Lote B1");
    expect(bOnly[0].category).toBe("MEDICAMENTOS");
  });

  it("returns every expense in the org when memberId is omitted", async () => {
    const all = await repo.findRecentExpenses(orgId, 10);
    const lotNames = all.map((e) => e.lot.name).sort();
    expect(lotNames).toEqual(["Lote A1", "Lote B1"]);
  });
});
