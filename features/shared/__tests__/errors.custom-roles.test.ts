/**
 * PR1.3 RED — 5 new RBAC custom-roles error codes (REQ-CR.2/CR.4/CR.6/CR.7 / D.4/D.5/D.10)
 *
 * Tests:
 * Each code must export as a string literal with the expected value.
 *
 * NAMING NOTE: spec uses SELF_LOCK_GUARD; design D.4 uses CANNOT_SELF_LOCK.
 * Per task instructions, spec's name (SELF_LOCK_GUARD) wins.
 * This test enforces SELF_LOCK_GUARD.
 *
 * NAMING NOTE: spec uses ROLE_HAS_MEMBERS (CR.7); design D.10 uses ROLE_IN_USE.
 * Per task instructions, spec's name (ROLE_HAS_MEMBERS) wins.
 * This test enforces ROLE_HAS_MEMBERS.
 */
import { describe, it, expect } from "vitest";
import {
  SYSTEM_ROLE_IMMUTABLE,
  SELF_LOCK_GUARD,
  SLUG_TAKEN,
  RESERVED_SLUG,
  ROLE_HAS_MEMBERS,
} from "@/features/shared/errors";

describe("PR1.3 — Custom-roles error codes", () => {
  it("SYSTEM_ROLE_IMMUTABLE exports as the correct string literal", () => {
    expect(SYSTEM_ROLE_IMMUTABLE).toBe("SYSTEM_ROLE_IMMUTABLE");
  });

  it("SELF_LOCK_GUARD exports as the correct string literal", () => {
    expect(SELF_LOCK_GUARD).toBe("SELF_LOCK_GUARD");
  });

  it("SLUG_TAKEN exports as the correct string literal", () => {
    expect(SLUG_TAKEN).toBe("SLUG_TAKEN");
  });

  it("RESERVED_SLUG exports as the correct string literal", () => {
    expect(RESERVED_SLUG).toBe("RESERVED_SLUG");
  });

  it("ROLE_HAS_MEMBERS exports as the correct string literal", () => {
    expect(ROLE_HAS_MEMBERS).toBe("ROLE_HAS_MEMBERS");
  });

  it("all 5 codes are distinct string values", () => {
    const codes = [
      SYSTEM_ROLE_IMMUTABLE,
      SELF_LOCK_GUARD,
      SLUG_TAKEN,
      RESERVED_SLUG,
      ROLE_HAS_MEMBERS,
    ];
    const unique = new Set(codes);
    expect(unique.size).toBe(5);
  });
});
