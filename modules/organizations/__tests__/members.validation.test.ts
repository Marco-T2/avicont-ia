/**
 * PR6.1 RED — buildAddMemberSchema / buildUpdateMemberRoleSchema factories.
 *
 * Covers:
 *   REQ-CR.8 (async role validation against the org's current CustomRole slugs)
 *   REQ-R.1-S3 / R.1-S4 (custom slug accepted, unknown slug rejected)
 *   REQ-R.1-S2 (owner stays NON-assignable — preserved from static enum)
 *   D.9 — async Zod refine with factory pattern threading orgId
 *
 * Strategy:
 *   Mock `rolesService.exists(orgId, slug)` — the async refine delegates to it.
 *   No real DB. The factory is a pure function; the async refine is the only
 *   dynamic piece, so we stub it with vi.spyOn.
 *
 * Contract (D.9):
 *   - buildAddMemberSchema(orgId) returns a Zod schema object
 *   - Valid payload + exists(true)  → parseAsync resolves
 *   - Unknown slug + exists(false)  → parseAsync rejects with ZodError
 *   - Owner slug                    → rejected BEFORE any DB hit (cheap path)
 *   - `.parse` (sync) on a schema with async refines → throws
 *     (Zod contract: async refinements CANNOT run under sync parse.
 *     Any legacy caller using .parse() gets an explicit error, not silent bypass.)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ZodError } from "zod";
import {
  buildAddMemberSchema,
  buildUpdateMemberRoleSchema,
} from "../domain/members.validation";
import { rolesService } from "../presentation/roles.service.singleton";

vi.mock("../presentation/roles.service.singleton", () => ({
  rolesService: {
    exists: vi.fn<(orgId: string, slug: string) => Promise<boolean>>(),
  },
}));

const ORG_ID = "alpha-org";

describe("buildAddMemberSchema(orgId) — factory + async refine (PR6.1 / D.9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(a) returns a Zod schema object for the given orgId", () => {
    const schema = buildAddMemberSchema(ORG_ID);
    expect(schema).toBeDefined();
    // The returned object is a Zod schema; assert both sync and async parse exist.
    expect(typeof schema.parseAsync).toBe("function");
    expect(typeof schema.safeParseAsync).toBe("function");
  });

  it("(b) resolves parseAsync with role='contador' when exists=true", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    const schema = buildAddMemberSchema(ORG_ID);

    const result = await schema.parseAsync({
      email: "user@example.com",
      role: "contador",
    });

    expect(result.role).toBe("contador");
    expect(result.email).toBe("user@example.com");
    expect(rolesService.exists).toHaveBeenCalledWith(ORG_ID, "contador");
  });

  it("(c) rejects parseAsync with role='bogus' when exists=false (ZodError)", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(false);
    const schema = buildAddMemberSchema(ORG_ID);

    await expect(
      schema.parseAsync({ email: "u@e.com", role: "bogus" }),
    ).rejects.toBeInstanceOf(ZodError);

    // Verify the error carries the "inexistente" message from the async refine.
    const result = await schema.safeParseAsync({
      email: "u@e.com",
      role: "bogus",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toMatch(/inexistente/i);
    }
  });

  it("(d) rejects role='owner' WITHOUT calling rolesService.exists (owner is non-assignable)", async () => {
    // Even if exists would return true, owner must be blocked by the SYNC refine first.
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    const schema = buildAddMemberSchema(ORG_ID);

    await expect(
      schema.parseAsync({ email: "u@e.com", role: "owner" }),
    ).rejects.toBeInstanceOf(ZodError);

    // The sync guard must fire before the DB check — no call to exists.
    expect(rolesService.exists).not.toHaveBeenCalled();
  });

  it("(e) allows role='member' (system role, assignable) when exists=true", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    const schema = buildAddMemberSchema(ORG_ID);

    const parsed = await schema.parseAsync({
      email: "m@e.com",
      role: "member",
    });
    expect(parsed.role).toBe("member");
  });

  it("(f) allows custom role='facturador' when exists=true", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    const schema = buildAddMemberSchema(ORG_ID);

    const parsed = await schema.parseAsync({
      email: "f@e.com",
      role: "facturador",
    });
    expect(parsed.role).toBe("facturador");
    expect(rolesService.exists).toHaveBeenCalledWith(ORG_ID, "facturador");
  });

  it("(g) rejects missing role with a ZodError (required field)", async () => {
    const schema = buildAddMemberSchema(ORG_ID);

    const result = await schema.safeParseAsync({ email: "x@e.com" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const roleIssue = result.error.issues.find(
        (i) => i.path.join(".") === "role",
      );
      expect(roleIssue).toBeDefined();
    }
  });

  it("(h) sync .parse() throws because schema has async refinements (contract enforcement)", () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    const schema = buildAddMemberSchema(ORG_ID);

    // Zod v4 rule: when a schema has an async refinement, calling .parse()
    // (the sync API) MUST throw — otherwise the async validation would be
    // silently skipped, which is worse than a loud error. This test is the
    // CONTRACT that catches any legacy caller that still does `.parse(body)`
    // on a members-validation schema (see PR6.2 contract grep).
    expect(() =>
      schema.parse({ email: "ok@e.com", role: "contador" }),
    ).toThrow();
  });
});

describe("buildUpdateMemberRoleSchema(orgId) — factory + async refine (PR6.1 / D.9)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves parseAsync with role='contador' when exists=true", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    const schema = buildUpdateMemberRoleSchema(ORG_ID);

    const parsed = await schema.parseAsync({ role: "contador" });
    expect(parsed.role).toBe("contador");
    expect(rolesService.exists).toHaveBeenCalledWith(ORG_ID, "contador");
  });

  it("rejects owner without touching rolesService.exists", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    const schema = buildUpdateMemberRoleSchema(ORG_ID);

    await expect(schema.parseAsync({ role: "owner" })).rejects.toBeInstanceOf(
      ZodError,
    );
    expect(rolesService.exists).not.toHaveBeenCalled();
  });

  it("rejects unknown slug when exists=false", async () => {
    vi.mocked(rolesService.exists).mockResolvedValue(false);
    const schema = buildUpdateMemberRoleSchema(ORG_ID);

    const result = await schema.safeParseAsync({ role: "cajero" });
    expect(result.success).toBe(false);
  });

  it("sync .parse() throws because of async refinement", () => {
    vi.mocked(rolesService.exists).mockResolvedValue(true);
    const schema = buildUpdateMemberRoleSchema(ORG_ID);

    expect(() => schema.parse({ role: "contador" })).toThrow();
  });
});
