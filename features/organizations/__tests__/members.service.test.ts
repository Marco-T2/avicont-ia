/**
 * PR2 2.1 RED — Members admin: assignableRoles + self-role-change
 *
 * Covers:
 *   REQ-R.1 — Role Set (5 assignables via admin API; owner/super-admin rejected)
 *   REQ-R.3 — Role mutability (self-role-change forbidden)
 *
 * Scenarios:
 *   S-R1-S1 — admin POSTs member with role=cobrador/auxiliar → Zod valid
 *   S-R1-S2 — admin POSTs role=owner → Zod error
 *   S-R3-S2 — actor self-PATCH role → ForbiddenError(CANNOT_CHANGE_OWN_ROLE)
 *
 * Gap-closure tests (accounting-rbac verify):
 *   REQ-R.2-S1 — cross-org isolation: same clerkUserId, different role per org
 *   REQ-R.2-S2 — duplicate active member → ConflictError (409 semantics)
 *   REQ-R.3-S1 — admin updates different member (happy path)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { addMemberSchema, updateRoleSchema } from "../members.validation";
import { MembersService } from "../members.service";
import {
  ForbiddenError,
  ConflictError,
  CANNOT_CHANGE_OWN_ROLE,
} from "@/features/shared/errors";

describe("addMemberSchema — assignableRoles (REQ-R.1)", () => {
  it("S-R1-S1 accepts cobrador", () => {
    const result = addMemberSchema.safeParse({
      email: "x@y.com",
      role: "cobrador",
    });
    expect(result.success).toBe(true);
  });

  it("S-R1-S1 accepts auxiliar", () => {
    const result = addMemberSchema.safeParse({
      email: "x@y.com",
      role: "auxiliar",
    });
    expect(result.success).toBe(true);
  });

  it("accepts admin/contador/member (regression)", () => {
    for (const role of ["admin", "contador", "member"] as const) {
      expect(
        addMemberSchema.safeParse({ email: "x@y.com", role }).success,
      ).toBe(true);
    }
  });

  it("S-R1-S2 rejects role=owner", () => {
    const result = addMemberSchema.safeParse({
      email: "x@y.com",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("R.1-S3 rejects role=super-admin", () => {
    const result = addMemberSchema.safeParse({
      email: "x@y.com",
      role: "super-admin",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateRoleSchema — assignableRoles (REQ-R.1)", () => {
  it("accepts the 5 assignable roles", () => {
    for (const role of [
      "admin",
      "contador",
      "cobrador",
      "auxiliar",
      "member",
    ] as const) {
      expect(updateRoleSchema.safeParse({ role }).success).toBe(true);
    }
  });

  it("rejects owner", () => {
    expect(updateRoleSchema.safeParse({ role: "owner" }).success).toBe(false);
  });
});

describe("MembersService.updateRole — self-role-change (REQ-R.3 / D.4)", () => {
  const ACTOR_CLERK_USER_ID = "user_actor_clerk";
  const TARGET_MEMBER_ID = "member_self_id";

  function buildService(memberRecord: {
    role: string;
    user: { clerkUserId: string };
  }) {
    const repo = {
      findMemberById: vi.fn().mockResolvedValue({
        id: TARGET_MEMBER_ID,
        role: memberRecord.role,
        userId: "u1",
        user: {
          clerkUserId: memberRecord.user.clerkUserId,
          email: "x@y.com",
          name: "x",
        },
      }),
      updateMemberRole: vi.fn(),
    } as unknown as ConstructorParameters<typeof MembersService>[0];
    return { service: new MembersService(repo), repo };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("S-R3-S2 — throws ForbiddenError when actor targets their own membership", async () => {
    const { service } = buildService({
      role: "contador",
      user: { clerkUserId: ACTOR_CLERK_USER_ID },
    });

    await expect(
      service.updateRole(
        "org_1",
        TARGET_MEMBER_ID,
        "admin",
        ACTOR_CLERK_USER_ID,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("S-R3-S2 — error carries code CANNOT_CHANGE_OWN_ROLE", async () => {
    const { service } = buildService({
      role: "contador",
      user: { clerkUserId: ACTOR_CLERK_USER_ID },
    });

    try {
      await service.updateRole(
        "org_1",
        TARGET_MEMBER_ID,
        "admin",
        ACTOR_CLERK_USER_ID,
      );
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(CANNOT_CHANGE_OWN_ROLE);
      expect((err as ForbiddenError).statusCode).toBe(403);
    }
  });

  it("CANNOT_CHANGE_OWN_ROLE constant is exported with correct literal value", async () => {
    const errors = await import("@/features/shared/errors");
    expect(errors.CANNOT_CHANGE_OWN_ROLE).toBe("CANNOT_CHANGE_OWN_ROLE");
  });

  it("POST_NOT_ALLOWED_FOR_ROLE constant is exported with correct literal value", async () => {
    const errors = await import("@/features/shared/errors");
    expect(errors.POST_NOT_ALLOWED_FOR_ROLE).toBe("POST_NOT_ALLOWED_FOR_ROLE");
  });
});

describe("MembersService.removeMember — self-deactivate guard (PR7 7.4 / D.4 consistency)", () => {
  const ACTOR_CLERK_USER_ID = "user_actor_clerk";
  const TARGET_MEMBER_ID = "member_self_id";

  function buildService(memberRecord: {
    role: string;
    user: { clerkUserId: string };
  }) {
    const repo = {
      findMemberById: vi.fn().mockResolvedValue({
        id: TARGET_MEMBER_ID,
        role: memberRecord.role,
        userId: "u1",
        user: {
          clerkUserId: memberRecord.user.clerkUserId,
          email: "x@y.com",
          name: "x",
        },
      }),
      findById: vi.fn(),
      deactivateMember: vi.fn(),
    } as unknown as ConstructorParameters<typeof MembersService>[0];
    return { service: new MembersService(repo), repo };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws ForbiddenError when actor targets their own membership (403 semantics like updateRole)", async () => {
    const { service } = buildService({
      role: "contador",
      user: { clerkUserId: ACTOR_CLERK_USER_ID },
    });

    await expect(
      service.removeMember("org_1", TARGET_MEMBER_ID, ACTOR_CLERK_USER_ID),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("error carries code CANNOT_CHANGE_OWN_ROLE and statusCode 403", async () => {
    const { service } = buildService({
      role: "contador",
      user: { clerkUserId: ACTOR_CLERK_USER_ID },
    });

    try {
      await service.removeMember(
        "org_1",
        TARGET_MEMBER_ID,
        ACTOR_CLERK_USER_ID,
      );
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(CANNOT_CHANGE_OWN_ROLE);
      expect((err as ForbiddenError).statusCode).toBe(403);
    }
  });
});

// ── Gap-closure: REQ-R.2-S1 — cross-org isolation ──────────────────────────

describe("MembersService — per-org scope (REQ-R.2)", () => {
  const SHARED_CLERK_USER = "user_shared_clerk";

  function buildServiceWithOrgMap(
    orgMap: Record<string, Array<{ id: string; role: string; userId: string; user: { clerkUserId: string; name: string; email: string } }>>,
  ) {
    const repo = {
      getMembers: vi.fn().mockImplementation((organizationId: string) => {
        const members = orgMap[organizationId] ?? [];
        return Promise.resolve({ members });
      }),
    } as unknown as ConstructorParameters<typeof MembersService>[0];
    return new MembersService(repo);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("REQ-R.2-S1 — same clerkUserId returns distinct roles per org", async () => {
    const service = buildServiceWithOrgMap({
      org_a: [
        {
          id: "m-a",
          role: "admin",
          userId: "u1",
          user: { clerkUserId: SHARED_CLERK_USER, name: "Juan", email: "juan@acme.com" },
        },
      ],
      org_b: [
        {
          id: "m-b",
          role: "cobrador",
          userId: "u1",
          user: { clerkUserId: SHARED_CLERK_USER, name: "Juan", email: "juan@acme.com" },
        },
      ],
    });

    const [membersA, membersB] = await Promise.all([
      service.listMembers("org_a"),
      service.listMembers("org_b"),
    ]);

    const entryA = membersA.find((m) => m.email === "juan@acme.com");
    const entryB = membersB.find((m) => m.email === "juan@acme.com");

    expect(entryA).toBeDefined();
    expect(entryB).toBeDefined();
    expect(entryA!.role).toBe("admin");
    expect(entryB!.role).toBe("cobrador");
    expect(entryA!.role).not.toBe(entryB!.role);
  });
});

// ── Gap-closure: REQ-R.2-S2 — duplicate active member → ConflictError ──────

describe("MembersService.addMember — duplicate detection (REQ-R.2-S2)", () => {
  const EXISTING_EMAIL = "existing@acme.com";

  function buildServiceForConflict() {
    const existingUser = {
      id: "u-existing",
      clerkUserId: "user_existing_clerk",
      email: EXISTING_EMAIL,
      name: "Existing User",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const activeMember = {
      id: "member-active",
      organizationId: "org_1",
      userId: "u-existing",
      role: "member",
      deactivatedAt: null, // active
      createdAt: new Date(),
      updatedAt: new Date(),
      user: existingUser,
    };

    const repo = {
      findMemberByEmail: vi.fn().mockResolvedValue(activeMember),
      addMember: vi.fn(),
      findById: vi.fn(),
    } as unknown as ConstructorParameters<typeof MembersService>[0];

    const usersService = {
      findByEmail: vi.fn().mockResolvedValue(existingUser),
    } as unknown as ConstructorParameters<typeof MembersService>[1];

    return { service: new MembersService(repo, usersService), repo, usersService };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("REQ-R.2-S2 — throws ConflictError when user is already an active member", async () => {
    const { service } = buildServiceForConflict();

    await expect(
      service.addMember("org_1", EXISTING_EMAIL, "contador"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("REQ-R.2-S2 — ConflictError has statusCode 409", async () => {
    const { service } = buildServiceForConflict();

    try {
      await service.addMember("org_1", EXISTING_EMAIL, "contador");
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).statusCode).toBe(409);
    }
  });

  it("REQ-R.2-S2 — repo.addMember is NOT called when conflict detected", async () => {
    const { service, repo } = buildServiceForConflict();

    try {
      await service.addMember("org_1", EXISTING_EMAIL, "contador");
    } catch {
      // expected
    }

    expect(repo!.addMember).not.toHaveBeenCalled();
  });
});

// ── Gap-closure: REQ-R.3-S1 — admin updates another member (happy path) ────

describe("MembersService.updateRole — admin modifies another member (REQ-R.3-S1)", () => {
  const ACTOR_CLERK_USER_ID = "user_actor_clerk";
  const TARGET_CLERK_USER_ID = "user_other_clerk";
  const TARGET_MEMBER_ID = "member_target_id";

  function buildServiceForUpdate() {
    const targetMember = {
      id: TARGET_MEMBER_ID,
      role: "member",
      userId: "u-other",
      organizationId: "org_1",
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      user: {
        clerkUserId: TARGET_CLERK_USER_ID,
        email: "other@acme.com",
        name: "Other User",
      },
    };

    const updatedMember = {
      id: TARGET_MEMBER_ID,
      role: "contador",
      userId: "u-other",
      organizationId: "org_1",
      deactivatedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const repo = {
      findMemberById: vi.fn().mockResolvedValue(targetMember),
      updateMemberRole: vi.fn().mockResolvedValue(updatedMember),
    } as unknown as ConstructorParameters<typeof MembersService>[0];

    return { service: new MembersService(repo), repo, targetMember, updatedMember };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("REQ-R.3-S1 — returns updated member with new role", async () => {
    const { service } = buildServiceForUpdate();

    const result = await service.updateRole(
      "org_1",
      TARGET_MEMBER_ID,
      "contador",
      ACTOR_CLERK_USER_ID,
    );

    expect(result).toMatchObject({
      id: TARGET_MEMBER_ID,
      role: "contador",
      userId: "u-other",
      name: "Other User",
      email: "other@acme.com",
    });
  });

  it("REQ-R.3-S1 — repo.updateMemberRole called with correct role", async () => {
    const { service, repo } = buildServiceForUpdate();

    await service.updateRole(
      "org_1",
      TARGET_MEMBER_ID,
      "contador",
      ACTOR_CLERK_USER_ID,
    );

    expect(repo!.updateMemberRole).toHaveBeenCalledWith(
      "org_1",
      TARGET_MEMBER_ID,
      "contador",
    );
  });
});
