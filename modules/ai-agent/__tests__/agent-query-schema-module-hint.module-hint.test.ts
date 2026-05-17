import { describe, expect, it } from "vitest";
import { agentQuerySchema } from "../domain/validation/agent.validation.ts";

// REQ-1 (design D1) — agentQuerySchema MUST declare module_hint as
// z.enum(MODULE_HINTS).nullable().optional(). Mirrors the surface field's
// RED locking precedent (agent-query-schema-surface.surface-separation.test.ts).
//
// Wire shape: optional + nullable. "accounting" | "farm" | null | absent
// all accepted; unknown enum values rejected with invalid_enum_value.

describe("SCN-1.1: schema accepts module_hint enum values", () => {
  it("safeParse with module_hint='accounting' returns success and preserves value", () => {
    const result = agentQuerySchema.safeParse({
      prompt: "x",
      surface: "sidebar-qa",
      module_hint: "accounting",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.module_hint).toBe("accounting");
    }
  });

  it("safeParse with module_hint='farm' returns success and preserves value", () => {
    const result = agentQuerySchema.safeParse({
      prompt: "x",
      surface: "sidebar-qa",
      module_hint: "farm",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.module_hint).toBe("farm");
    }
  });
});

describe("SCN-1.2: schema accepts module_hint=null (explicit null)", () => {
  it("safeParse with module_hint=null returns success and preserves null", () => {
    const result = agentQuerySchema.safeParse({
      prompt: "x",
      surface: "sidebar-qa",
      module_hint: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.module_hint).toBeNull();
    }
  });
});

describe("SCN-1.3: schema accepts ABSENT module_hint (legacy modal callers)", () => {
  it("safeParse without module_hint key returns success and undefined", () => {
    const result = agentQuerySchema.safeParse({
      prompt: "x",
      surface: "sidebar-qa",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.module_hint).toBeUndefined();
    }
  });
});

describe("SCN-1.4: schema rejects unknown module_hint string", () => {
  it("safeParse with module_hint='foo' returns success: false", () => {
    const result = agentQuerySchema.safeParse({
      prompt: "x",
      surface: "sidebar-qa",
      module_hint: "foo",
    });
    expect(result.success).toBe(false);
  });

  it("issue code on path ['module_hint'] indicates enum violation", () => {
    const result = agentQuerySchema.safeParse({
      prompt: "x",
      surface: "sidebar-qa",
      module_hint: "foo",
    });
    if (result.success) throw new Error("Expected failure");
    const issues = result.error.issues.filter(
      (i) => i.path.join(".") === "module_hint",
    );
    expect(issues.length).toBeGreaterThan(0);
    // Zod v4 enum violations: invalid_value | invalid_enum_value | invalid_type
    expect(issues[0]?.code).toMatch(
      /^(invalid_enum_value|invalid_value|invalid_type)$/,
    );
  });
});
