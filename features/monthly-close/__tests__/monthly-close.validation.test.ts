import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { closeRequestSchema } from "../monthly-close.validation";

describe("closeRequestSchema", () => {
  it("accepts valid payload with periodId only", () => {
    expect(() => closeRequestSchema.parse({ periodId: "abc" })).not.toThrow();
  });

  it("accepts payload with justification string", () => {
    expect(() =>
      closeRequestSchema.parse({ periodId: "abc", justification: "reason" }),
    ).not.toThrow();
  });

  it("rejects missing periodId", () => {
    expect(() => closeRequestSchema.parse({})).toThrow(ZodError);
  });

  it("rejects non-string periodId", () => {
    expect(() => closeRequestSchema.parse({ periodId: 123 })).toThrow(ZodError);
  });
});
