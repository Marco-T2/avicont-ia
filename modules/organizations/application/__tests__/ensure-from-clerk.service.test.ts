import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, NotFoundError } from "@/features/shared/errors";
import { EnsureFromClerkService } from "../ensure-from-clerk.service";
import type {
  ClerkAuthPort,
  ClerkMembershipInfo,
  ClerkOrganizationInfo,
} from "../../domain/ports/clerk-auth.port";
import type { OrganizationsService } from "../organizations.service";
import type { MembersService } from "../members.service";

const ORG_SLUG = "acme";
const CLERK_ORG_ID = "org_clerk_123";
const CLERK_USER_ID = "user_clerk_456";
const LOCAL_ORG_ID = "cuid_org_abc";

function makeClerkAuthStub(
  overrides: Partial<ClerkAuthPort> = {},
): ClerkAuthPort {
  return {
    getUsersByEmail: vi.fn(async () => []),
    createOrganizationMembership: vi.fn(async () => {}),
    deleteOrganizationMembership: vi.fn(async () => {}),
    getOrganization: vi.fn(async () => null),
    findMembership: vi.fn(async () => null),
    ...overrides,
  };
}

function makeOrgsStub(
  overrides: Partial<OrganizationsService> = {},
): OrganizationsService {
  return {
    getByClerkId: vi.fn(async () => {
      throw new NotFoundError("Organizacion");
    }),
    getMemberByClerkUserId: vi.fn(async () => {
      throw new ForbiddenError();
    }),
    syncOrganization: vi.fn(),
    ...overrides,
  } as unknown as OrganizationsService;
}

function makeMembersStub(
  overrides: Partial<MembersService> = {},
): MembersService {
  return {
    addMember: vi.fn(async () => ({
      id: "member_id",
      role: "org:member",
      userId: "user_id",
      name: "User",
      email: "user@example.com",
    })),
    ...overrides,
  } as unknown as MembersService;
}

describe("EnsureFromClerkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns orgId without Clerk calls when org+member already exist locally", async () => {
    const clerkAuth = makeClerkAuthStub();
    const organizations = makeOrgsStub({
      getByClerkId: vi.fn(async () => ({ id: LOCAL_ORG_ID }) as never),
      getMemberByClerkUserId: vi.fn(async () => ({ id: "m1" }) as never),
    });
    const members = makeMembersStub();

    const svc = new EnsureFromClerkService({
      clerkAuth,
      organizations,
      members,
    });
    const result = await svc.ensure(CLERK_ORG_ID, CLERK_USER_ID);

    expect(result).toEqual({ orgId: LOCAL_ORG_ID });
    expect(clerkAuth.getOrganization).not.toHaveBeenCalled();
    expect(clerkAuth.findMembership).not.toHaveBeenCalled();
    expect(organizations.syncOrganization).not.toHaveBeenCalled();
    expect(members.addMember).not.toHaveBeenCalled();
  });

  it("addMember when org exists locally but member is missing and IS member in Clerk", async () => {
    const membershipInfo: ClerkMembershipInfo = {
      role: "org:member",
      email: "alice@example.com",
      firstName: "Alice",
      lastName: null,
    };
    const clerkAuth = makeClerkAuthStub({
      findMembership: vi.fn(async () => membershipInfo),
    });
    const organizations = makeOrgsStub({
      getByClerkId: vi.fn(async () => ({ id: LOCAL_ORG_ID }) as never),
      // member NO existe local → throws Forbidden, which we catch
      getMemberByClerkUserId: vi.fn(async () => {
        throw new ForbiddenError();
      }),
    });
    const members = makeMembersStub();

    const svc = new EnsureFromClerkService({
      clerkAuth,
      organizations,
      members,
    });
    const result = await svc.ensure(CLERK_ORG_ID, CLERK_USER_ID);

    expect(result).toEqual({ orgId: LOCAL_ORG_ID });
    expect(members.addMember).toHaveBeenCalledWith(
      LOCAL_ORG_ID,
      "alice@example.com",
      "org:member",
    );
    expect(organizations.syncOrganization).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when org exists locally, member missing, AND user not in Clerk org", async () => {
    const clerkAuth = makeClerkAuthStub({
      findMembership: vi.fn(async () => null),
    });
    const organizations = makeOrgsStub({
      getByClerkId: vi.fn(async () => ({ id: LOCAL_ORG_ID }) as never),
      getMemberByClerkUserId: vi.fn(async () => {
        throw new ForbiddenError();
      }),
    });
    const members = makeMembersStub();

    const svc = new EnsureFromClerkService({
      clerkAuth,
      organizations,
      members,
    });

    await expect(svc.ensure(CLERK_ORG_ID, CLERK_USER_ID)).rejects.toThrow(
      ForbiddenError,
    );
    expect(members.addMember).not.toHaveBeenCalled();
  });

  it("calls syncOrganization when org missing and user IS owner in Clerk", async () => {
    const ownerMembership: ClerkMembershipInfo = {
      role: "org:admin",
      email: "owner@example.com",
      firstName: "Owner",
      lastName: null,
    };
    const orgInfo: ClerkOrganizationInfo = {
      id: CLERK_ORG_ID,
      name: "ACME Inc",
      slug: ORG_SLUG,
    };
    const clerkAuth = makeClerkAuthStub({
      findMembership: vi.fn(async () => ownerMembership),
      getOrganization: vi.fn(async () => orgInfo),
    });
    const organizations = makeOrgsStub({
      // org NO existe local → throws NotFoundError, caught
      getByClerkId: vi.fn(async () => {
        throw new NotFoundError("Organizacion");
      }),
      syncOrganization: vi.fn(async () => ({
        organization: { id: LOCAL_ORG_ID } as never,
        created: true,
      })),
    });
    const members = makeMembersStub();

    const svc = new EnsureFromClerkService({
      clerkAuth,
      organizations,
      members,
    });
    const result = await svc.ensure(CLERK_ORG_ID, CLERK_USER_ID);

    expect(result).toEqual({ orgId: LOCAL_ORG_ID });
    expect(organizations.syncOrganization).toHaveBeenCalledWith(
      { clerkOrgId: CLERK_ORG_ID, name: "ACME Inc", slug: ORG_SLUG },
      CLERK_USER_ID,
    );
    expect(members.addMember).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when org missing AND user is NOT owner in Clerk", async () => {
    const memberMembership: ClerkMembershipInfo = {
      role: "org:member",
      email: "bob@example.com",
      firstName: "Bob",
      lastName: null,
    };
    const clerkAuth = makeClerkAuthStub({
      findMembership: vi.fn(async () => memberMembership),
    });
    const organizations = makeOrgsStub({
      getByClerkId: vi.fn(async () => {
        throw new NotFoundError("Organizacion");
      }),
    });
    const members = makeMembersStub();

    const svc = new EnsureFromClerkService({
      clerkAuth,
      organizations,
      members,
    });

    await expect(svc.ensure(CLERK_ORG_ID, CLERK_USER_ID)).rejects.toThrow(
      /propietario/i,
    );
    expect(organizations.syncOrganization).not.toHaveBeenCalled();
    expect(members.addMember).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when org missing AND user is NOT a member in Clerk at all", async () => {
    const clerkAuth = makeClerkAuthStub({
      findMembership: vi.fn(async () => null),
    });
    const organizations = makeOrgsStub({
      getByClerkId: vi.fn(async () => {
        throw new NotFoundError("Organizacion");
      }),
    });
    const members = makeMembersStub();

    const svc = new EnsureFromClerkService({
      clerkAuth,
      organizations,
      members,
    });

    await expect(svc.ensure(CLERK_ORG_ID, CLERK_USER_ID)).rejects.toThrow(
      ForbiddenError,
    );
  });
});
