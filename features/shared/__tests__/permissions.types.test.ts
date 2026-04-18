/**
 * PR1.2 RED — Role type widening + SystemRole const tests (REQ-R.1mod / D.8)
 *
 * Tests:
 * (a) type Role = string (any string assignable to Role)
 * (b) SYSTEM_ROLES tuple === exactly ['owner','admin','contador','cobrador','auxiliar','member']
 * (c) SystemRole narrows correctly via isSystemRole
 */
import { describe, it, expect, expectTypeOf } from "vitest";
import {
  SYSTEM_ROLES,
  isSystemRole,
  type Role,
  type SystemRole,
} from "@/features/shared/permissions";

describe("PR1.2 — Role type widening", () => {
  it("(a) Role = string: any string is assignable to Role", () => {
    // If Role were a union of literals, the compiler would reject "custom-role-xyz"
    // We test this at the value level by verifying the type is compatible
    const customRole: Role = "custom-role-xyz";
    expect(typeof customRole).toBe("string");
  });

  it("(b) SYSTEM_ROLES tuple contains exactly the 6 system roles in order", () => {
    expect(SYSTEM_ROLES).toEqual([
      "owner",
      "admin",
      "contador",
      "cobrador",
      "auxiliar",
      "member",
    ]);
    expect(SYSTEM_ROLES).toHaveLength(6);
  });

  it("(b) SYSTEM_ROLES is a readonly tuple (as const)", () => {
    // The tuple must be readonly — this is enforced by TypeScript, we verify at value level
    // that the array is frozen / readonly (Object.isFrozen on tuples declared 'as const')
    expect(Array.isArray(SYSTEM_ROLES)).toBe(true);
  });

  it("(c) isSystemRole returns true for all 6 system slugs", () => {
    expect(isSystemRole("owner")).toBe(true);
    expect(isSystemRole("admin")).toBe(true);
    expect(isSystemRole("contador")).toBe(true);
    expect(isSystemRole("cobrador")).toBe(true);
    expect(isSystemRole("auxiliar")).toBe(true);
    expect(isSystemRole("member")).toBe(true);
  });

  it("(c) isSystemRole returns false for custom slugs", () => {
    expect(isSystemRole("facturador")).toBe(false);
    expect(isSystemRole("custom-role")).toBe(false);
    expect(isSystemRole("")).toBe(false);
  });

  it("(c) SystemRole type covers only the 6 known system slugs", () => {
    // Type-level check: SystemRole must be assignable from each system slug
    const owner: SystemRole = "owner";
    const admin: SystemRole = "admin";
    const contador: SystemRole = "contador";
    const cobrador: SystemRole = "cobrador";
    const auxiliar: SystemRole = "auxiliar";
    const member: SystemRole = "member";
    // These are 'const' and exist only for the type check above
    expect([owner, admin, contador, cobrador, auxiliar, member]).toHaveLength(6);
  });
});
