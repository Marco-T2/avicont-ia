/**
 * PR4.3 RED — RolesService: CRUD + self-lock guard + member guard + normalize
 *
 * Covers:
 *   REQ-CR.2 — System role immutability (PATCH/DELETE → 403 SYSTEM_ROLE_IMMUTABLE)
 *   REQ-CR.3 — Template snapshot on create (independent of template afterward)
 *   REQ-CR.5 — Edit matrix + canPost (calls revalidateOrgMatrix on success)
 *   REQ-CR.6 — Self-lock guard (D.4): caller cannot strip members.write from OWN role
 *   REQ-CR.7 — Delete guard + member guard (409 ROLE_HAS_MEMBERS)
 *   D.4 — Self-lock algorithm (role-based, not hardcoded to "admin")
 *   D.11 — Array normalize on write (sort + dedupe)
 *   R.4 — Data access contract
 *
 * Strategy:
 *   Mock the repository, cache invalidator, and member lookup util.
 *   No DB, no real cache.
 *
 * SECURITY-CRITICAL test cases (A/B/C/D/E — see D.4):
 *   A — same-role + strips members.write → throws SELF_LOCK_GUARD
 *   B — caller edits DIFFERENT role → no guard
 *   C — same-role + no permission change → no guard
 *   D — same-role + keeps members.write → no guard
 *   E — custom role "org_admin" (not literal "admin") — guard is role-based
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RolesService } from "../roles.service";
import {
  ForbiddenError,
  ConflictError,
  NotFoundError,
  ValidationError,
  SYSTEM_ROLE_IMMUTABLE,
  SELF_LOCK_GUARD,
  ROLE_HAS_MEMBERS,
  RESERVED_SLUG,
  SLUG_TAKEN,
} from "@/features/shared/errors";

// ────────────────────────────────────────────────────────────
// Test helpers: build a service with injected mocks
// ────────────────────────────────────────────────────────────
type RoleRow = {
  id: string;
  organizationId: string;
  slug: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionsRead: string[];
  permissionsWrite: string[];
  canPost: string[];
  createdAt: Date;
  updatedAt: Date;
};

function makeRole(overrides: Partial<RoleRow> = {}): RoleRow {
  return {
    id: "r-" + (overrides.slug ?? "x"),
    organizationId: "org_1",
    slug: "facturador",
    name: "Facturador",
    description: null,
    isSystem: false,
    permissionsRead: [],
    permissionsWrite: [],
    canPost: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildService(opts: {
  rolesByOrg?: RoleRow[];
  callerRoleSlug?: string; // caller's current OrganizationMember.role
  memberCountBySlug?: Record<string, number>;
}) {
  const rolesByOrg = opts.rolesByOrg ?? [];

  const repo = {
    findAllByOrg: vi.fn().mockResolvedValue(rolesByOrg),
    findBySlug: vi.fn().mockImplementation((_orgId: string, slug: string) =>
      Promise.resolve(rolesByOrg.find((r) => r.slug === slug) ?? null),
    ),
    create: vi.fn().mockImplementation((data: Partial<RoleRow>) =>
      Promise.resolve(makeRole({ id: "r-new", ...data })),
    ),
    update: vi.fn().mockImplementation((id: string, patch: Partial<RoleRow>) => {
      const existing = rolesByOrg.find((r) => r.id === id);
      return Promise.resolve({ ...(existing ?? makeRole({ id })), ...patch });
    }),
    delete: vi.fn().mockImplementation((id: string) =>
      Promise.resolve(rolesByOrg.find((r) => r.id === id) ?? makeRole({ id })),
    ),
    countMembers: vi.fn().mockImplementation((slug: string) =>
      Promise.resolve(opts.memberCountBySlug?.[slug] ?? 0),
    ),
  };

  const revalidateOrgMatrix = vi.fn();

  const getCallerRoleSlug = vi.fn().mockResolvedValue(opts.callerRoleSlug ?? null);

  const service = new RolesService({
    repo: repo as unknown as ConstructorParameters<typeof RolesService>[0]["repo"],
    revalidateOrgMatrix,
    getCallerRoleSlug,
  });

  return { service, repo, revalidateOrgMatrix, getCallerRoleSlug };
}

const CALLER = { clerkUserId: "user_actor" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// listRoles + getRole + exists
// ────────────────────────────────────────────────────────────

describe("RolesService.listRoles", () => {
  it("returns all roles from repo (system + custom)", async () => {
    const roles = [
      makeRole({ id: "r1", slug: "admin", isSystem: true }),
      makeRole({ id: "r2", slug: "facturador", isSystem: false }),
    ];
    const { service, repo } = buildService({ rolesByOrg: roles });

    const result = await service.listRoles("org_1");

    expect(repo.findAllByOrg).toHaveBeenCalledWith("org_1");
    expect(result).toHaveLength(2);
  });
});

describe("RolesService.getRole", () => {
  it("returns the role when slug exists", async () => {
    const role = makeRole({ slug: "facturador" });
    const { service } = buildService({ rolesByOrg: [role] });

    const result = await service.getRole("org_1", "facturador");
    expect(result.slug).toBe("facturador");
  });

  it("throws NotFoundError when slug does not exist", async () => {
    const { service } = buildService({ rolesByOrg: [] });

    await expect(service.getRole("org_1", "missing")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("RolesService.exists", () => {
  it("returns true when slug exists in org", async () => {
    const { service } = buildService({
      rolesByOrg: [makeRole({ slug: "facturador" })],
    });
    expect(await service.exists("org_1", "facturador")).toBe(true);
  });

  it("returns false when slug does not exist in org", async () => {
    const { service } = buildService({ rolesByOrg: [] });
    expect(await service.exists("org_1", "anything")).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// createRole — template snapshot, slug rules, normalize, revalidate
// ────────────────────────────────────────────────────────────

describe("RolesService.createRole — happy path (CR.3)", () => {
  it("derives slug from name and snapshots template matrix", async () => {
    const template = makeRole({
      id: "r-contador",
      slug: "contador",
      isSystem: true,
      permissionsRead: ["sales", "reports"],
      permissionsWrite: ["sales", "reports"],
      canPost: ["sales"],
    });
    const { service, repo, revalidateOrgMatrix } = buildService({
      rolesByOrg: [template],
      callerRoleSlug: "admin",
    });

    await service.createRole(
      "org_1",
      { name: "Facturador", templateSlug: "contador" },
      CALLER,
    );

    expect(repo.create).toHaveBeenCalledTimes(1);
    const createArgs = repo.create.mock.calls[0][0] as RoleRow;
    expect(createArgs.organizationId).toBe("org_1");
    expect(createArgs.slug).toBe("facturador");
    expect(createArgs.name).toBe("Facturador");
    expect(createArgs.isSystem).toBe(false);
    // Snapshot from template (sorted + deduped — see D.11 test below)
    expect(createArgs.permissionsRead).toEqual(["reports", "sales"]);
    expect(createArgs.permissionsWrite).toEqual(["reports", "sales"]);
    expect(createArgs.canPost).toEqual(["sales"]);

    expect(revalidateOrgMatrix).toHaveBeenCalledWith("org_1");
  });

  it("rejects reserved slug with RESERVED_SLUG (422)", async () => {
    const { service } = buildService({
      rolesByOrg: [makeRole({ slug: "contador", isSystem: true })],
      callerRoleSlug: "admin",
    });

    await expect(
      service.createRole(
        "org_1",
        { name: "Owner", templateSlug: "contador" }, // derives "owner" → reserved
        CALLER,
      ),
    ).rejects.toMatchObject({ code: RESERVED_SLUG, statusCode: 422 });
  });

  it("resolves collision with -2 suffix when base slug is taken", async () => {
    const template = makeRole({
      id: "r-contador",
      slug: "contador",
      isSystem: true,
      permissionsRead: [],
      permissionsWrite: [],
      canPost: [],
    });
    const existing = makeRole({ id: "r-ex", slug: "facturador" });
    const { service, repo } = buildService({
      rolesByOrg: [template, existing],
      callerRoleSlug: "admin",
    });

    await service.createRole(
      "org_1",
      { name: "Facturador", templateSlug: "contador" },
      CALLER,
    );

    const createArgs = repo.create.mock.calls[0][0] as RoleRow;
    expect(createArgs.slug).toBe("facturador-2");
  });

  it("throws NotFoundError when templateSlug does not exist", async () => {
    const { service } = buildService({
      rolesByOrg: [],
      callerRoleSlug: "admin",
    });

    await expect(
      service.createRole(
        "org_1",
        { name: "Facturador", templateSlug: "nonexistent" },
        CALLER,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("RolesService.createRole — array normalize (D.11)", () => {
  it("sorts and dedupes arrays on write (template snapshot path)", async () => {
    const template = makeRole({
      id: "r-contador",
      slug: "contador",
      isSystem: true,
      // Intentionally unsorted + duplicated to prove normalization
      permissionsRead: ["sales", "sales", "reports", "reports"],
      permissionsWrite: ["sales", "reports", "sales"],
      canPost: ["sales", "sales"],
    });
    const { service, repo } = buildService({
      rolesByOrg: [template],
      callerRoleSlug: "admin",
    });

    await service.createRole(
      "org_1",
      { name: "Facturador", templateSlug: "contador" },
      CALLER,
    );

    const createArgs = repo.create.mock.calls[0][0] as RoleRow;
    expect(createArgs.permissionsRead).toEqual(["reports", "sales"]);
    expect(createArgs.permissionsWrite).toEqual(["reports", "sales"]);
    expect(createArgs.canPost).toEqual(["sales"]);
  });
});

// ────────────────────────────────────────────────────────────
// updateRole — system immutability, self-lock (A/B/C/D/E), normalize
// ────────────────────────────────────────────────────────────

describe("RolesService.updateRole — system immutability (CR.2)", () => {
  it("rejects PATCH on isSystem=true with SYSTEM_ROLE_IMMUTABLE (403)", async () => {
    const admin = makeRole({
      id: "r-admin",
      slug: "admin",
      isSystem: true,
      permissionsWrite: ["members"],
    });
    const { service } = buildService({
      rolesByOrg: [admin],
      callerRoleSlug: "admin",
    });

    try {
      await service.updateRole(
        "org_1",
        "admin",
        { name: "Super Admin" },
        CALLER,
      );
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(SYSTEM_ROLE_IMMUTABLE);
      expect((err as ForbiddenError).statusCode).toBe(403);
    }
  });
});

describe("RolesService.updateRole — self-lock guard (CR.6 / D.4)", () => {
  // A — Admin with role "admin" edits role "admin", removes "members" → THROWS
  it("(A) same-role + strips members.write → throws SELF_LOCK_GUARD (403)", async () => {
    // For case A we need admin to NOT be system so it's editable in the first
    // place — so use a CUSTOM "admin" role carrying members.write.
    const adminCustom = makeRole({
      id: "r-admin",
      slug: "admin-custom",
      isSystem: false,
      permissionsWrite: ["members", "sales"],
    });
    const { service } = buildService({
      rolesByOrg: [adminCustom],
      callerRoleSlug: "admin-custom",
    });

    try {
      await service.updateRole(
        "org_1",
        "admin-custom",
        { permissionsWrite: ["sales"] }, // strips "members"
        CALLER,
      );
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(SELF_LOCK_GUARD);
      expect((err as ForbiddenError).statusCode).toBe(403);
    }
  });

  // B — Admin with role "admin" edits a DIFFERENT role → no guard
  it("(B) caller edits DIFFERENT role → does NOT trigger guard", async () => {
    const adminCustom = makeRole({
      id: "r-admin",
      slug: "admin-custom",
      isSystem: false,
      permissionsWrite: ["members"],
    });
    const contador = makeRole({
      id: "r-contador",
      slug: "contador-custom",
      isSystem: false,
      permissionsWrite: ["members", "sales"],
    });
    const { service, repo, revalidateOrgMatrix } = buildService({
      rolesByOrg: [adminCustom, contador],
      callerRoleSlug: "admin-custom",
    });

    await service.updateRole(
      "org_1",
      "contador-custom",
      { permissionsWrite: ["sales"] }, // strips members from ANOTHER role → fine
      CALLER,
    );

    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(revalidateOrgMatrix).toHaveBeenCalledWith("org_1");
  });

  // C — Same-role, only renames → no guard
  it("(C) same-role + permissions unchanged → does NOT trigger guard", async () => {
    const adminCustom = makeRole({
      id: "r-admin",
      slug: "admin-custom",
      isSystem: false,
      permissionsWrite: ["members"],
    });
    const { service, repo } = buildService({
      rolesByOrg: [adminCustom],
      callerRoleSlug: "admin-custom",
    });

    await service.updateRole(
      "org_1",
      "admin-custom",
      { name: "Renombrado" }, // no permission change
      CALLER,
    );

    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  // D — Same-role, adds resources but KEEPS "members" → no guard
  it("(D) same-role + keeps members.write → does NOT trigger guard", async () => {
    const adminCustom = makeRole({
      id: "r-admin",
      slug: "admin-custom",
      isSystem: false,
      permissionsWrite: ["members"],
    });
    const { service, repo } = buildService({
      rolesByOrg: [adminCustom],
      callerRoleSlug: "admin-custom",
    });

    await service.updateRole(
      "org_1",
      "admin-custom",
      { permissionsWrite: ["members", "sales", "reports"] }, // still has members
      CALLER,
    );

    expect(repo.update).toHaveBeenCalledTimes(1);
  });

  // E — guard is role-based, not hardcoded to "admin" slug
  it("(E) caller with CUSTOM role org_admin editing own role that strips members.write → throws SELF_LOCK_GUARD", async () => {
    const orgAdmin = makeRole({
      id: "r-org-admin",
      slug: "org_admin",
      isSystem: false,
      permissionsWrite: ["members", "sales"],
    });
    const { service } = buildService({
      rolesByOrg: [orgAdmin],
      callerRoleSlug: "org_admin",
    });

    try {
      await service.updateRole(
        "org_1",
        "org_admin",
        { permissionsWrite: ["sales"] }, // strips "members"
        CALLER,
      );
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(SELF_LOCK_GUARD);
    }
  });
});

describe("RolesService.updateRole — normalize + revalidate + immutable slug (D.11, CR.5)", () => {
  it("normalizes patch arrays before repo.update (sort + dedupe)", async () => {
    const role = makeRole({
      id: "r-f",
      slug: "facturador",
      permissionsWrite: ["sales"],
    });
    const { service, repo } = buildService({
      rolesByOrg: [role],
      callerRoleSlug: "admin-custom",
    });

    await service.updateRole(
      "org_1",
      "facturador",
      {
        permissionsWrite: ["sales", "sales", "reports"],
        permissionsRead: ["contacts", "sales", "contacts"],
        canPost: ["sales", "sales"],
      },
      CALLER,
    );

    const [updatedId, patch] = repo.update.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(updatedId).toBe("r-f");
    expect(patch.permissionsWrite).toEqual(["reports", "sales"]);
    expect(patch.permissionsRead).toEqual(["contacts", "sales"]);
    expect(patch.canPost).toEqual(["sales"]);
  });

  it("calls revalidateOrgMatrix after successful update (CR.5-S3)", async () => {
    const role = makeRole({ id: "r-f", slug: "facturador" });
    const { service, revalidateOrgMatrix } = buildService({
      rolesByOrg: [role],
      callerRoleSlug: "admin-custom",
    });

    await service.updateRole(
      "org_1",
      "facturador",
      { name: "F updated" },
      CALLER,
    );

    expect(revalidateOrgMatrix).toHaveBeenCalledWith("org_1");
  });

  it("strips `slug` from patch (D.5: slug immutable on update)", async () => {
    const role = makeRole({ id: "r-f", slug: "facturador" });
    const { service, repo } = buildService({
      rolesByOrg: [role],
      callerRoleSlug: "admin-custom",
    });

    await service.updateRole(
      "org_1",
      "facturador",
      { slug: "hacker", name: "F" } as never,
      CALLER,
    );

    const patch = repo.update.mock.calls[0][1] as Record<string, unknown>;
    expect(patch.slug).toBeUndefined();
    expect(patch.name).toBe("F");
  });

  it("throws NotFoundError when role slug does not exist", async () => {
    const { service } = buildService({
      rolesByOrg: [],
      callerRoleSlug: "admin-custom",
    });

    await expect(
      service.updateRole("org_1", "nope", { name: "x" }, CALLER),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ────────────────────────────────────────────────────────────
// deleteRole — system immutability, member guard, revalidate
// ────────────────────────────────────────────────────────────

describe("RolesService.deleteRole (CR.7)", () => {
  it("rejects DELETE on isSystem=true with SYSTEM_ROLE_IMMUTABLE (403)", async () => {
    const admin = makeRole({
      id: "r-admin",
      slug: "admin",
      isSystem: true,
    });
    const { service } = buildService({
      rolesByOrg: [admin],
      callerRoleSlug: "admin",
    });

    try {
      await service.deleteRole("org_1", "admin", CALLER);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenError);
      expect((err as ForbiddenError).code).toBe(SYSTEM_ROLE_IMMUTABLE);
      expect((err as ForbiddenError).statusCode).toBe(403);
    }
  });

  it("rejects DELETE when members are assigned (409 ROLE_HAS_MEMBERS)", async () => {
    const facturador = makeRole({
      id: "r-f",
      slug: "facturador",
      isSystem: false,
    });
    const { service, repo } = buildService({
      rolesByOrg: [facturador],
      callerRoleSlug: "admin",
      memberCountBySlug: { facturador: 2 },
    });

    try {
      await service.deleteRole("org_1", "facturador", CALLER);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictError);
      expect((err as ConflictError).code).toBe(ROLE_HAS_MEMBERS);
      expect((err as ConflictError).statusCode).toBe(409);
    }
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it("deletes when no members are assigned + revalidates cache", async () => {
    const facturador = makeRole({
      id: "r-f",
      slug: "facturador",
      isSystem: false,
    });
    const { service, repo, revalidateOrgMatrix } = buildService({
      rolesByOrg: [facturador],
      callerRoleSlug: "admin",
      memberCountBySlug: { facturador: 0 },
    });

    await service.deleteRole("org_1", "facturador", CALLER);

    expect(repo.delete).toHaveBeenCalledWith("r-f");
    expect(revalidateOrgMatrix).toHaveBeenCalledWith("org_1");
  });

  it("throws NotFoundError when role slug does not exist", async () => {
    const { service } = buildService({
      rolesByOrg: [],
      callerRoleSlug: "admin",
    });

    await expect(
      service.deleteRole("org_1", "missing", CALLER),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ────────────────────────────────────────────────────────────
// Silence unused-import lint noise (kept for grep-ability of codes)
// ────────────────────────────────────────────────────────────
void ValidationError;
void SLUG_TAKEN;
