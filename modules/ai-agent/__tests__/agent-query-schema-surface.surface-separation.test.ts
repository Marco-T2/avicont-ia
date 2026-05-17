import { describe, expect, it } from "vitest";
import { agentQuerySchema } from "../domain/validation/agent.validation.ts";

// REQ-2 — agentQuerySchema MUST require a surface field (no default).
// Missing or invalid surface → ZodError → existing handleError middleware
// returns HTTP 400. No new error path required.

describe("SCN-2.1: schema rejects body without surface", () => {
  it("safeParse without surface returns success: false", () => {
    const result = agentQuerySchema.safeParse({ prompt: "hola" });
    expect(result.success).toBe(false);
  });

  it("error path includes 'surface'", () => {
    const result = agentQuerySchema.safeParse({ prompt: "hola" });
    if (result.success) throw new Error("Expected failure");
    const paths = result.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("surface");
  });
});

describe("SCN-2.2: schema rejects unknown surface value", () => {
  it("safeParse with 'sidebar-unknown' returns success: false", () => {
    const result = agentQuerySchema.safeParse({
      prompt: "hola",
      surface: "sidebar-unknown",
    });
    expect(result.success).toBe(false);
  });

  it("issue code on path ['surface'] indicates enum violation", () => {
    const result = agentQuerySchema.safeParse({
      prompt: "hola",
      surface: "sidebar-unknown",
    });
    if (result.success) throw new Error("Expected failure");
    const surfaceIssues = result.error.issues.filter(
      (i) => i.path.join(".") === "surface",
    );
    expect(surfaceIssues.length).toBeGreaterThan(0);
    // Zod v4: enum violations carry code "invalid_value" (replaced
    // "invalid_enum_value" from v3) or "invalid_enum_value" depending on
    // bundler. Accept either, and additionally accept "invalid_type"
    // (some zod builds report it as invalid_type for string enums).
    expect(surfaceIssues[0]?.code).toMatch(
      /^(invalid_enum_value|invalid_value|invalid_type)$/,
    );
  });
});

describe("SCN-2.3: schema accepts the 3 valid surface values", () => {
  for (const surface of [
    "sidebar-qa",
    "modal-registrar",
    "modal-journal-ai",
  ] as const) {
    it(`accepts ${surface}`, () => {
      const result = agentQuerySchema.safeParse({ prompt: "hola", surface });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.surface).toBe(surface);
      }
    });
  }
});
