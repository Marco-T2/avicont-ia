import { describe, it, expect } from "vitest";
import { MortalityCount } from "../value-objects/mortality-count";
import { InvalidMortalityCount } from "../errors/mortality-errors";

describe("MortalityCount", () => {
  it("accepts positive integers", () => {
    expect(MortalityCount.of(1).value).toBe(1);
    expect(MortalityCount.of(100).value).toBe(100);
  });

  it("rejects non-integers", () => {
    expect(() => MortalityCount.of(1.5)).toThrow(InvalidMortalityCount);
    expect(() => MortalityCount.of(0.1)).toThrow(InvalidMortalityCount);
  });

  it("rejects zero and negatives", () => {
    expect(() => MortalityCount.of(0)).toThrow(InvalidMortalityCount);
    expect(() => MortalityCount.of(-1)).toThrow(InvalidMortalityCount);
  });

  it("equals identifies same values", () => {
    expect(MortalityCount.of(5).equals(MortalityCount.of(5))).toBe(true);
    expect(MortalityCount.of(5).equals(MortalityCount.of(6))).toBe(false);
  });
});
