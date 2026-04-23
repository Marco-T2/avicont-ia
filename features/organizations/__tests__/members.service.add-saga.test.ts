/**
 * RED test — `addMember` new-member saga rewire (T8).
 *
 * Covers spec scenarios S-MCS.1-1 through S-MCS.1-5 AND REQ-MCS.6 (silent-fail
 * elimination) AND REQ-MCS.5 (observability).
 *
 * Expected failure mode at commit time (pre-T9):
 *   - `members.service.ts:124-136` currently calls `createOrganizationMembership`
 *     BEFORE `repo.addMember`, then SWALLOWS non-duplicate Clerk errors and
 *     proceeds to the DB write.
 *   - S-MCS.1-2 (DB fails -> no Clerk call) FAILS because Clerk IS called first.
 *   - S-MCS.1-3 (Clerk fails -> ExternalSyncError + hardDelete) FAILS because
 *     (a) the error is swallowed, (b) `hardDelete` is not called, (c) no
 *     `ExternalSyncError` is thrown, (d) the DB write still proceeds.
 *   - S-MCS.1-4 (double failure -> divergent log) FAILS for the same reason
 *     as S-MCS.1-3 — the saga path is never entered.
 *   - S-MCS.6-1 (non-duplicate surfaces as 503) FAILS — returns 201.
 *   - REQ-MCS.5 log assertions (divergent only on double failure) FAIL — no
 *     structured logs emitted today.
 *
 * The GREEN task (T9) rewires the body to `runMemberClerkSaga` with
 *   dbWrite: repo.addMember, clerkCall: createOrganizationMembership,
 *   compensate: repo.hardDelete, isIdempotentSuccess: isClerkDuplicateMembershipError.
 *
 * NOTE on Clerk mock: we `vi.mock("@clerk/nextjs/server")` and stub
 * `clerkClient` so `organizations.createOrganizationMembership` and
 * `users.getUserList` are injectable per test. Error objects are built via the
 * real `ClerkAPIResponseError` SDK constructor so `isClerkAPIResponseError`
 * returns true and the production classifier path is exercised
 * (closes `aspirational_mock_signals_unimplemented_contract` feedback).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ClerkAPIResponseError } from "@clerk/shared/error";

const mockCreateOrganizationMembership = vi.fn();
const mockDeleteOrganizationMembership = vi.fn();
const mockGetUserList = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    organizations: {
      createOrganizationMembership: mockCreateOrganizationMembership,
      deleteOrganizationMembership: mockDeleteOrganizationMembership,
    },
    users: {
      getUserList: mockGetUserList,
    },
  }),
}));

import { MembersService } from "../members.service";
import { ExternalSyncError } from "@/features/shared/errors";

const ORG_ID = "org_test";
const ORG = { id: ORG_ID, clerkOrgId: "clerk_org_test", name: "Test Org" };
const EMAIL = "newmember@acme.com";
const USER_DB = {
  id: "user_db_1",
  clerkUserId: "user_clerk_1",
  email: EMAIL,
  name: "New Member",
};
const CREATED_MEMBER = {
  id: "member_new_1",
  organizationId: ORG_ID,
  userId: USER_DB.id,
  role: "contador",
  deactivatedAt: null,
};

function buildService() {
  const repo = {
    findMemberByEmail: vi.fn().mockResolvedValue(null), // no prior membership
    findById: vi.fn().mockResolvedValue(ORG),
    addMember: vi.fn().mockResolvedValue(CREATED_MEMBER),
    hardDelete: vi.fn().mockResolvedValue({ count: 1 }),
    reactivateMember: vi.fn(),
    deactivateMember: vi.fn(),
    findMemberById: vi.fn(),
  } as unknown as ConstructorParameters<typeof MembersService>[0];

  const usersService = {
    findByEmail: vi.fn().mockResolvedValue(USER_DB),
    create: vi.fn(),
  } as unknown as ConstructorParameters<typeof MembersService>[1];

  return {
    service: new MembersService(repo, usersService),
    repo,
    usersService,
  };
}

function duplicateClerkError(): ClerkAPIResponseError {
  return new ClerkAPIResponseError("Duplicate", {
    data: [
      {
        code: "already_a_member_in_organization",
        message: "Already a member",
      },
    ],
    status: 422,
  });
}

function nonDuplicateClerkError(): ClerkAPIResponseError {
  return new ClerkAPIResponseError("Clerk down", {
    data: [{ code: "internal_server_error", message: "Clerk internal error" }],
    status: 500,
  });
}

describe("MembersService.addMember — new-member saga (REQ-MCS.1, REQ-MCS.6)", () => {
  let consoleInfo: ReturnType<typeof vi.spyOn>;
  let consoleWarn: ReturnType<typeof vi.spyOn>;
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOrganizationMembership.mockReset();
    mockDeleteOrganizationMembership.mockReset();
    mockGetUserList.mockReset();
    consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfo.mockRestore();
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  // ── S-MCS.1-1 — Happy path ──────────────────────────────────────────────

  it("S-MCS.1-1 — DB and Clerk both succeed: returns member DTO, logCommitted fires", async () => {
    const { service, repo } = buildService();
    mockCreateOrganizationMembership.mockResolvedValue({});

    const result = await service.addMember(ORG_ID, EMAIL, "contador");

    expect(result).toMatchObject({
      id: CREATED_MEMBER.id,
      role: "contador",
      userId: USER_DB.id,
      email: EMAIL,
    });
    expect(repo!.addMember).toHaveBeenCalledTimes(1);
    expect(mockCreateOrganizationMembership).toHaveBeenCalledTimes(1);
    // Divergent log MUST NOT fire on happy path
    const divergentCalls = consoleError.mock.calls.filter((c) =>
      String(c[0]).includes("members.clerk_sync.divergent"),
    );
    expect(divergentCalls).toHaveLength(0);
  });

  // ── S-MCS.1-2 — DB-first ordering: DB fails -> no Clerk call ────────────

  it("S-MCS.1-2 — DB insert fails: Clerk NEVER called, error bubbles", async () => {
    const { service, repo } = buildService();
    (repo!.addMember as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down"),
    );

    await expect(
      service.addMember(ORG_ID, EMAIL, "contador"),
    ).rejects.toThrow(/db down/);
    expect(mockCreateOrganizationMembership).not.toHaveBeenCalled();
    expect(repo!.hardDelete).not.toHaveBeenCalled();
  });

  // ── S-MCS.1-3 — Clerk fails; compensation succeeds ──────────────────────

  it("S-MCS.1-3 — Clerk fails non-duplicate: hardDelete compensates; ExternalSyncError 503", async () => {
    const { service, repo } = buildService();
    mockCreateOrganizationMembership.mockRejectedValueOnce(nonDuplicateClerkError());

    let caught: unknown;
    try {
      await service.addMember(ORG_ID, EMAIL, "contador");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ExternalSyncError);
    expect((caught as ExternalSyncError).statusCode).toBe(503);
    expect((caught as ExternalSyncError).details).toMatchObject({
      divergentState: {
        dbState: "member_inserted",
        clerkState: "membership_absent",
      },
      operation: "add",
    });
    expect(repo!.addMember).toHaveBeenCalledTimes(1);
    expect(repo!.hardDelete).toHaveBeenCalledWith(ORG_ID, CREATED_MEMBER.id);
    // compensated log fires (warn); divergent log MUST NOT fire
    const compensatedCalls = consoleWarn.mock.calls.filter((c) =>
      String(c[0]).includes("members.clerk_sync.compensated"),
    );
    expect(compensatedCalls).toHaveLength(1);
    const divergentCalls = consoleError.mock.calls.filter((c) =>
      String(c[0]).includes("members.clerk_sync.divergent"),
    );
    expect(divergentCalls).toHaveLength(0);
  });

  // ── S-MCS.1-4 — Double failure: Clerk + compensation ────────────────────

  it("S-MCS.1-4 — double failure: ExternalSyncError with divergentState; logDivergent fires once", async () => {
    const { service, repo } = buildService();
    mockCreateOrganizationMembership.mockRejectedValueOnce(nonDuplicateClerkError());
    (repo!.hardDelete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("db down during compensation"),
    );

    let caught: unknown;
    try {
      await service.addMember(ORG_ID, EMAIL, "contador");
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ExternalSyncError);
    expect((caught as ExternalSyncError).details).toMatchObject({
      divergentState: {
        dbState: "member_inserted",
        clerkState: "membership_absent",
      },
      operation: "add",
    });
    // divergent log fires exactly once with required schema
    const divergentCalls = consoleError.mock.calls.filter((c) =>
      String(c[0]).includes("members.clerk_sync.divergent"),
    );
    expect(divergentCalls).toHaveLength(1);
    const logPayload = JSON.parse(divergentCalls[0][0] as string);
    expect(logPayload).toMatchObject({
      event: "members.clerk_sync.divergent",
      operation: "add",
      organizationId: ORG_ID,
      memberId: CREATED_MEMBER.id,
      clerkUserId: USER_DB.clerkUserId,
      dbState: "member_inserted",
      clerkState: "membership_absent",
    });
    expect(logPayload.correlationId).toBeTypeOf("string");
    expect(logPayload.correlationId.length).toBeGreaterThan(0);
    // compensated log MUST NOT fire on double failure
    const compensatedCalls = consoleWarn.mock.calls.filter((c) =>
      String(c[0]).includes("members.clerk_sync.compensated"),
    );
    expect(compensatedCalls).toHaveLength(0);
  });

  // ── S-MCS.1-5 — Idempotent duplicate: no compensation, 200 ──────────────

  it("S-MCS.1-5 — Clerk returns duplicate-membership: idempotent success, no compensation", async () => {
    const { service, repo } = buildService();
    mockCreateOrganizationMembership.mockRejectedValueOnce(duplicateClerkError());

    const result = await service.addMember(ORG_ID, EMAIL, "contador");
    expect(result.id).toBe(CREATED_MEMBER.id);
    expect(repo!.hardDelete).not.toHaveBeenCalled();
    // compensated + divergent MUST NOT fire on idempotent path
    const compensatedCalls = consoleWarn.mock.calls.filter((c) =>
      String(c[0]).includes("members.clerk_sync.compensated"),
    );
    expect(compensatedCalls).toHaveLength(0);
    const divergentCalls = consoleError.mock.calls.filter((c) =>
      String(c[0]).includes("members.clerk_sync.divergent"),
    );
    expect(divergentCalls).toHaveLength(0);
  });

  // ── S-MCS.6-1 — non-duplicate Clerk error surfaces as 503 (not swallowed) ──

  it("S-MCS.6-1 — non-duplicate Clerk error is NOT swallowed: surfaces as 503 and DB row removed", async () => {
    const { service, repo } = buildService();
    mockCreateOrganizationMembership.mockRejectedValueOnce(nonDuplicateClerkError());

    await expect(
      service.addMember(ORG_ID, EMAIL, "contador"),
    ).rejects.toBeInstanceOf(ExternalSyncError);

    // Compensation ran: hardDelete called => DB row would be absent after this call.
    expect(repo!.hardDelete).toHaveBeenCalledWith(ORG_ID, CREATED_MEMBER.id);
  });
});
