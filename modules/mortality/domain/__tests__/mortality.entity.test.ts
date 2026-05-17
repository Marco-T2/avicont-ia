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

describe("Mortality.update", () => {
  const existing = () => Mortality.log(baseInput); // count=10

  it("returns a new instance with updated count (immutable)", () => {
    const m = existing();

    const updated = m.update({ count: 7, aliveCountInLot: 90 });

    expect(updated).not.toBe(m);
    expect(updated.count.value).toBe(7);
    expect(m.count.value).toBe(10); // original unchanged
  });

  it("preserves identity and lotId/organizationId (INV-02)", () => {
    const m = existing();

    const updated = m.update({ count: 7, aliveCountInLot: 90 });

    expect(updated.id).toBe(m.id);
    expect(updated.lotId).toBe(m.lotId);
    expect(updated.organizationId).toBe(m.organizationId);
  });

  it("updates cause and date when provided; keeps prior when omitted", () => {
    const m = existing();
    const newDate = new Date("2026-05-15");

    const updated = m.update({
      cause: "enfermedad",
      date: newDate,
      aliveCountInLot: 100,
    });

    expect(updated.cause).toBe("enfermedad");
    expect(updated.date).toEqual(newDate);
    expect(updated.count.value).toBe(10); // count unchanged
  });

  it("treats explicit cause: null as a clear (different from undefined)", () => {
    const m = Mortality.log({ ...baseInput, cause: "respiratoria" });

    const updated = m.update({ cause: null, aliveCountInLot: 100 });

    expect(updated.cause).toBeNull();
  });

  it("throws MortalityCountExceedsAlive when newCount > aliveCountInLot", () => {
    const m = existing();

    expect(() =>
      m.update({ count: 11, aliveCountInLot: 10 }),
    ).toThrow(MortalityCountExceedsAlive);
  });

  it("allows newCount exactly equal to aliveCountInLot (boundary)", () => {
    const m = existing();

    const updated = m.update({ count: 50, aliveCountInLot: 50 });

    expect(updated.count.value).toBe(50);
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
