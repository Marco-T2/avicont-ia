import { describe, it, expect } from "vitest";
import { Nit } from "../value-objects/nit";
import { InvalidNitFormat } from "../errors/contact-errors";

describe("Nit", () => {
  it("accepts a valid NIT under the max length", () => {
    const nit = Nit.of("12345678");
    expect(nit.value).toBe("12345678");
  });

  it("accepts a NIT exactly at the max length (20 chars)", () => {
    const nit = Nit.of("12345678901234567890");
    expect(nit.value).toBe("12345678901234567890");
  });

  it("rejects a NIT longer than 20 characters", () => {
    expect(() => Nit.of("123456789012345678901")).toThrow(InvalidNitFormat);
  });

  it("rejects an empty string", () => {
    expect(() => Nit.of("")).toThrow(InvalidNitFormat);
  });

  it("trims surrounding whitespace before validating length", () => {
    const nit = Nit.of("  12345  ");
    expect(nit.value).toBe("12345");
  });

  it("rejects a string that is only whitespace", () => {
    expect(() => Nit.of("   ")).toThrow(InvalidNitFormat);
  });

  it("equals returns true for same value", () => {
    expect(Nit.of("12345").equals(Nit.of("12345"))).toBe(true);
  });

  it("equals returns false for different values", () => {
    expect(Nit.of("12345").equals(Nit.of("67890"))).toBe(false);
  });

  it("toString returns the inner value", () => {
    expect(Nit.of("12345").toString()).toBe("12345");
  });
});
