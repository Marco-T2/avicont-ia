import { describe, it, expect } from "vitest";
import { Mortality } from "../mortality.entity";
import { MortalityCountExceedsAlive } from "../errors/mortality-errors";

const baseInput = {
  lotId: "lot-1",
  count: 10,
  date: new Date("2026-04-01"),
  createdById: "user-1",
  organizationId: "org-1",
  aliveCountInLot: 100,
};

describe("Mortality.log", () => {
  it("creates a mortality entity when count <= alive", () => {
    const m = Mortality.log(baseInput);
    expect(m.count.value).toBe(10);
    expect(m.lotId).toBe("lot-1");
    expect(m.organizationId).toBe("org-1");
    expect(m.id).toBeDefined();
  });

  it("allows count exactly equal to alive", () => {
    const m = Mortality.log({ ...baseInput, count: 100 });
    expect(m.count.value).toBe(100);
  });

  it("throws MortalityCountExceedsAlive when count > alive", () => {
    expect(() => Mortality.log({ ...baseInput, count: 101 })).toThrow(
      MortalityCountExceedsAlive,
    );
  });

  it("attaches the alive count to the error details for debugging", () => {
    try {
      Mortality.log({ ...baseInput, count: 200, aliveCountInLot: 50 });
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(MortalityCountExceedsAlive);
      expect((err as MortalityCountExceedsAlive).details).toEqual({ aliveCount: 50 });
    }
  });

  it("preserves cause when provided", () => {
    const m = Mortality.log({ ...baseInput, cause: "enfermedad" });
    expect(m.cause).toBe("enfermedad");
  });

  it("defaults cause to null when omitted", () => {
    const m = Mortality.log(baseInput);
    expect(m.cause).toBeNull();
  });
});

describe("Mortality.toJSON", () => {
  it("serializes count as a primitive number, not a value object", () => {
    const m = Mortality.log(baseInput);
    expect(m.toJSON().count).toBe(10);
    expect(typeof m.toJSON().count).toBe("number");
  });

  it("omits relations when not loaded", () => {
    const m = Mortality.log(baseInput);
    expect(m.toJSON()).not.toHaveProperty("lot");
    expect(m.toJSON()).not.toHaveProperty("createdBy");
  });
});
