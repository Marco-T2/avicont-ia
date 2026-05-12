/**
 * RED test — `removeMember` saga rewire (T11).
 *
 * Covers spec scenarios S-MCS.3-1 through S-MCS.3-5 AND REQ-MCS.5
 * observability for the remove operation.
 *
 * Expected failure mode at RED-commit time (pre-T11 GREEN):
 *
 *   Current removeMember body at members.service.ts:~188-222:
 *     1. findMemberById guard (OK)
 *     2. owner-rejection / self-deactivate guard (OK)
 *     3. Clerk deleteOrganizationMembership INSIDE try/catch that SWALLOWS
 *        ALL errors (including 404 and 500s). Comment: "Si no se encuentra
 *        en Clerk, ignorar".
 *     4. repo.deactivateMember (unconditionally, even after Clerk error).
 *
 *   Declared failure modes:
 *     - S-MCS.3-2 (DB fails -> no Clerk call): FAILS because today Clerk
 *       is called BEFORE repo.deactivateMember.
 *     - S-MCS.3-3 (Clerk fails non-404, compensation reactivates, 503):
 *       FAILS because Clerk error is swallowed — no ExternalSyncError,
 *       no compensation, deactivateMember still proceeds.
 *     - S-MCS.3-4 (double failure): FAILS for the same reason; the
 *       double-failure path is never entered.
 *     - S-MCS.3-5 (404 -> idempotent success): passes today because the
 *       swallow catches 404 the same as any other error; the GREEN path
 *       preserves this outcome while making the classifier guard
 *       explicit (REQ-MCS.3-5).
 *     - S-MCS.3-1 (happy path): passes today for the same
 *       swallow-plus-deactivate reason; GREEN preserves it while also
 *       enforcing DB-first ordering.
 *
 * Clerk errors built via the real SDK ClerkAPIResponseError constructor
 * so isClerkAPIResponseError returns true and the production classifier
 * path runs (closes aspirational_mock_signals_unimplemented_contract
 * feedback).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClerkAPIResponseError } from "@clerk/shared/error";

const mockCreateOrganizationMembership = vi.fn();
const mockDeleteOrganizationMembership = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    organizations: {
      createOrganizationMembership: mockCreateOrganizationMembership,
      deleteOrganizationMembership: mockDeleteOrganizationMembership,
    },
    users: {
      getUserList: vi.fn(),
    },
  }),
}));

import { MembersService } from "../application/members.service";
import { ExternalSyncError } from "@/features/shared/errors";

const ORG_ID = "org_test";
const ORG = { id: ORG_ID, clerkOrgId: "clerk_org_test", name: "Test Org" };
const MEMBER_ID = "member_active_1";
const ACTOR_CLERK_USER_ID = "user_actor_clerk";
const TARGET_USER = {
  id: "user_target_db",
  clerkUserId: "user_target_clerk",
  email: "target@acme.com",
  name: "Target User",
};
const ACTIVE_MEMBER = {
  id: MEMBER_ID,
  organizationId: ORG_ID,
  userId: TARGET_USER.id,
  role: "contador",
  deactivatedAt: null,
  user: TARGET_USER,
};
const DEACTIVATED_ROW = {
  ...ACTIVE_MEMBER,
  deactivatedAt: new Date("2026-04-23"),
};

function buildService() {
  const repo = {
    findMemberById: vi.fn().mockResolvedValue(ACTIVE_MEMBER),
    findById: vi.fn().mockResolvedValue(ORG),
    deactivateMember: vi.fn().mockResolvedValue(DEACTIVATED_ROW),
    reactivateMember: vi.fn().mockResolvedValue(ACTIVE_MEMBER),
    hardDelete: vi.fn(),
    addMember: vi.fn(),
    findMemberByEmail: vi.fn(),
  } as unknown as ConstructorParameters<typeof MembersService>[0]["repo"];

  const clerkAuth = {
    getUsersByEmail: vi.fn(),
    createOrganizationMembership: mockCreateOrganizationMembership,
    deleteOrganizationMembership: mockDeleteOrganizationMembership,
  } as unknown as ConstructorParameters<typeof MembersService>[0]["clerkAuth"];

  return { service: new MembersService({ repo, users: {} as any, clerkAuth }), repo };
}

function notFoundClerkError(): ClerkAPIResponseError {
  return new ClerkAPIResponseError("Not found", {
    data: [{ code: "resource_not_found", message: "Membership not found" }],
    status: 404,
  });
}

function nonNotFoundClerkError(): ClerkAPIResponseError {
  return new ClerkAPIResponseError("Clerk down", {
    data: [{ code: "internal_server_error", message: "Clerk internal" }],
    status: 500,
  });
}

describe("MembersService.removeMember — saga (REQ-MCS.3)", () => {
  let consoleInfo: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOrganizationMembership.mockReset();
    mockDeleteOrganizationMembership.mockReset();
    consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfo.mockRestore();
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  it("S-MCS.3-1 — happy path: deactivateMember + Clerk delete both succeed", async () => {
    const { service, repo } = buildService();
    mockDeleteOrganizationMembership.mockResolvedValue({});

    await service.removeMember(ORG_ID, MEMBER_ID, ACTOR_CLERK_USER_ID);

    expect(repo!.deactivateMember).toHaveBeenCalledWith(ORG_ID, MEMBER_ID);
    expect(mockDeleteOrganizationMembership).toHaveBeenCalledTimes(1);
    expect(repo!.reactivateMember).not.toHaveBeenCalled();
    const divergentCalls = consoleError.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes("members.clerk_sync.divergent"),
    );
    expect(divergentCalls).toHaveLength(0);
  });

  it("S-MCS.3-2 — deactivateMember fails: Clerk NEVER called, error bubbles", async () => {
    const { service, repo } = buildService();
    (repo!.deactivateMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down"),
    );

    await expect(
      service.removeMember(ORG_ID, MEMBER_ID, ACTOR_CLERK_USER_ID),
    ).rejects.toThrow(/db down/);
    expect(mockDeleteOrganizationMembership).not.toHaveBeenCalled();
    expect(repo!.reactivateMember).not.toHaveBeenCalled();
  });

  it("S-MCS.3-3 — Clerk fails non-404: compensation reactivates with previousRole; 503", async () => {
    const { service, repo } = buildService();
    mockDeleteOrganizationMembership.mockRejectedValueOnce(nonNotFoundClerkError());

    let caught: unknown;
    try {
      await service.removeMember(ORG_ID, MEMBER_ID, ACTOR_CLERK_USER_ID);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ExternalSyncError);
    expect((caught as ExternalSyncError).statusCode).toBe(503);
    expect((caught as ExternalSyncError).details).toMatchObject({
      operation: "remove",
      divergentState: {
        dbState: "member_deactivated",
        clerkState: "membership_present",
      },
    });
    // Compensation: reactivate with the PREVIOUS role captured pre-flight.
    expect(repo!.reactivateMember).toHaveBeenCalledWith(
      ORG_ID,
      MEMBER_ID,
      ACTIVE_MEMBER.role, // "contador" — previousRole
    );
    const compensatedCalls = consoleWarn.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes("members.clerk_sync.compensated"),
    );
    expect(compensatedCalls).toHaveLength(1);
    const payload = JSON.parse(compensatedCalls[0][0] as string);
    expect(payload.operation).toBe("remove");
  });

  it("S-MCS.3-4 — double failure (Clerk + compensation): divergent log + 503", async () => {
    const { service, repo } = buildService();
    mockDeleteOrganizationMembership.mockRejectedValueOnce(nonNotFoundClerkError());
    (repo!.reactivateMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down during compensation"),
    );

    let caught: unknown;
    try {
      await service.removeMember(ORG_ID, MEMBER_ID, ACTOR_CLERK_USER_ID);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ExternalSyncError);
    expect((caught as ExternalSyncError).details).toMatchObject({
      operation: "remove",
      divergentState: {
        dbState: "member_deactivated",
        clerkState: "membership_present",
      },
    });
    const divergentCalls = consoleError.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes("members.clerk_sync.divergent"),
    );
    expect(divergentCalls).toHaveLength(1);
    const payload = JSON.parse(divergentCalls[0][0] as string);
    // S-MCS.5-3: full field schema
    expect(payload).toMatchObject({
      event: "members.clerk_sync.divergent",
      operation: "remove",
      organizationId: ORG_ID,
      memberId: MEMBER_ID,
      clerkUserId: TARGET_USER.clerkUserId,
      dbState: "member_deactivated",
      clerkState: "membership_present",
    });
    expect(payload.correlationId).toBeTypeOf("string");
    expect(payload.correlationId.length).toBeGreaterThan(0);
    const compensatedCalls = consoleWarn.mock.calls.filter((c: unknown[]) =>
      String(c[0]).includes("members.clerk_sync.compensated"),
    );
    expect(compensatedCalls).toHaveLength(0);
  });

  it("S-MCS.3-5 — Clerk returns 404: idempotent success, no compensation", async () => {
    const { service, repo } = buildService();
    mockDeleteOrganizationMembership.mockRejectedValueOnce(notFoundClerkError());

    await service.removeMember(ORG_ID, MEMBER_ID, ACTOR_CLERK_USER_ID);

    expect(repo!.deactivateMember).toHaveBeenCalledWith(ORG_ID, MEMBER_ID);
    expect(repo!.reactivateMember).not.toHaveBeenCalled();
  });

  it("previousRole is captured from findMemberById result BEFORE deactivateMember runs", async () => {
    // If the pre-flight member has role "cobrador", compensation MUST
    // restore "cobrador" — not whatever default. This guards against a
    // regression where compensate re-reads after deactivation (which
    // would return the now-soft-deleted row with no role info available).
    const repo = {
      findMemberById: vi.fn().mockResolvedValue({
        ...ACTIVE_MEMBER,
        role: "cobrador",
      }),
      findById: vi.fn().mockResolvedValue(ORG),
      deactivateMember: vi.fn().mockResolvedValue(DEACTIVATED_ROW),
      reactivateMember: vi.fn().mockResolvedValue(ACTIVE_MEMBER),
      hardDelete: vi.fn(),
      addMember: vi.fn(),
      findMemberByEmail: vi.fn(),
    } as unknown as ConstructorParameters<typeof MembersService>[0]["repo"];
    const clerkAuth2 = {
      getUsersByEmail: vi.fn(),
      createOrganizationMembership: mockCreateOrganizationMembership,
      deleteOrganizationMembership: mockDeleteOrganizationMembership,
    } as unknown as ConstructorParameters<typeof MembersService>[0]["clerkAuth"];
    const service = new MembersService({ repo, users: {} as any, clerkAuth: clerkAuth2 });
    mockDeleteOrganizationMembership.mockRejectedValueOnce(nonNotFoundClerkError());

    await service
      .removeMember(ORG_ID, MEMBER_ID, ACTOR_CLERK_USER_ID)
      .catch(() => {
        /* expected 503 */
      });

    expect(repo!.reactivateMember).toHaveBeenCalledWith(
      ORG_ID,
      MEMBER_ID,
      "cobrador",
    );
  });
});
