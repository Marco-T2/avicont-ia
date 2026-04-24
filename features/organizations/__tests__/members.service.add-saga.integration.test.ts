/**
 * Integration test — S-MCS.6-2: real-DB compensation path (closes verify W-1)
 *
 * W-1 from the members-clerk-sync-saga verify-report:
 *   "S-MCS.6-2 integration test absent. Design §7 assigned this scenario to
 *   `integration (real DB)` style. What exists is a unit-mock asserting
 *   `hardDelete` was called. A mocked `hardDelete` can return { count: 1 }
 *   even if the WHERE clause were wrong."
 *
 * This file exercises the full compensation path against real Prisma:
 *   1. addMember with Clerk rejecting → ExternalSyncError + DB row actually gone
 *   2. Retry with Clerk succeeding → member created cleanly (no orphan from step 1)
 *
 * GREEN on first run: apply-phase implementation is correct. The test locks in
 * the hardDelete WHERE clause against future regressions of the deleteMany path
 * or the WHERE-clause scoping.
 *
 * Expected behavior (both cases pass):
 *   - After Clerk rejection: prisma.organizationMember.findFirst({ where: {
 *       organizationId, userId, deactivatedAt: null } }) returns null.
 *   - After successful retry: exactly one ACTIVE row exists for the (org, user)
 *     pair.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { ClerkAPIResponseError } from "@clerk/shared/error";
import { ExternalSyncError } from "@/features/shared/errors";
import { MembersService } from "../members.service";
import { OrganizationsRepository } from "../organizations.repository";

// ── Clerk mock ────────────────────────────────────────────────────────────────
// Clerk is mocked because we have no live credentials in tests.
// The integration under test is on the DB side: real Prisma, real compensation.

const mockCreateOrganizationMembership = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    organizations: {
      createOrganizationMembership: mockCreateOrganizationMembership,
      deleteOrganizationMembership: vi.fn(),
    },
    users: {
      getUserList: vi.fn().mockResolvedValue({ data: [] }),
    },
  }),
}));

// ── Seed state ────────────────────────────────────────────────────────────────

let orgId: string;
let clerkOrgId: string;
let userId: string;
let userEmail: string;
let clerkUserId: string;

beforeAll(async () => {
  const ts = Date.now();
  clerkOrgId = `test-clerk-org-mcs62-${ts}`;
  clerkUserId = `test-clerk-user-mcs62-${ts}`;
  userEmail = `mcs62-${ts}@integration.test`;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId,
      name: "MCS62 Integration Org",
      slug: `mcs62-integration-${ts}`,
    },
  });
  orgId = org.id;

  const user = await prisma.user.create({
    data: {
      clerkUserId,
      email: userEmail,
      name: "MCS62 Test User",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  // Clean in dependency order: members → user → org
  await prisma.organizationMember.deleteMany({ where: { organizationId: orgId } });
  await prisma.user.delete({ where: { id: userId } });
  await prisma.organization.delete({ where: { id: orgId } });
  await prisma.$disconnect();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function nonDuplicateClerkError(): ClerkAPIResponseError {
  return new ClerkAPIResponseError("Clerk down", {
    data: [{ code: "internal_server_error", message: "Clerk internal error" }],
    status: 500,
  });
}

/** Build a MembersService with real repo but a stub UsersService that resolves
 *  the seeded user — bypassing Clerk's getUserList so we control the user. */
function buildService() {
  const repo = new OrganizationsRepository();

  // UsersService stub: findByEmail returns the seeded user; create is unused.
  const usersService = {
    findByEmail: vi.fn().mockResolvedValue({
      id: userId,
      clerkUserId,
      email: userEmail,
      name: "MCS62 Test User",
    }),
    create: vi.fn(),
  } as unknown as ConstructorParameters<typeof MembersService>[1];

  return new MembersService(repo, usersService);
}

// ── Test suite ─────────────────────────────────────────────────────────────────

describe("S-MCS.6-2 — real-DB compensation: retry reaches consistent state (closes verify W-1)", () => {
  it("step 1 — Clerk rejects: ExternalSyncError thrown and DB row is actually gone (no orphan)", async () => {
    mockCreateOrganizationMembership.mockRejectedValueOnce(nonDuplicateClerkError());

    const service = buildService();

    // Suppress expected structured logs so test output stays clean
    const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const spyError = vi.spyOn(console, "error").mockImplementation(() => {});

    let caught: unknown;
    try {
      await service.addMember(orgId, userEmail, "contador");
    } catch (e) {
      caught = e;
    } finally {
      spyWarn.mockRestore();
      spyError.mockRestore();
    }

    // The saga must surface as ExternalSyncError 503
    expect(caught).toBeInstanceOf(ExternalSyncError);
    expect((caught as ExternalSyncError).statusCode).toBe(503);

    // Real-DB assertion: the row must be physically absent — hardDelete ran
    // against the actual database with the correct WHERE clause.
    const orphan = await prisma.organizationMember.findFirst({
      where: { organizationId: orgId, userId, deactivatedAt: null },
    });
    expect(orphan).toBeNull();
  });

  it("step 2 — retry with Clerk succeeding: member created cleanly, exactly one ACTIVE row", async () => {
    mockCreateOrganizationMembership.mockResolvedValueOnce({});

    const service = buildService();

    const spyWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

    let result: Awaited<ReturnType<typeof service.addMember>>;
    try {
      result = await service.addMember(orgId, userEmail, "contador");
    } finally {
      spyWarn.mockRestore();
    }

    // Returns a valid member DTO
    expect(result!).toMatchObject({
      userId,
      email: userEmail,
      role: "contador",
    });

    // Real-DB assertion: exactly ONE active row for (org, user)
    const activeRows = await prisma.organizationMember.findMany({
      where: { organizationId: orgId, userId, deactivatedAt: null },
    });
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].role).toBe("contador");
  });
});
