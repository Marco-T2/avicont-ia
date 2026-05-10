import { describe, expect, it, beforeEach, vi } from "vitest";
import { Farm } from "../farm.entity";

describe("Farm entity behavioral", () => {
  const baseInput = {
    name: "Granja San Antonio",
    location: "Km 5 Ruta 4",
    memberId: "member-cuid-1",
    organizationId: "org-cuid-1",
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));
  });

  // α6
  it("Farm.create produces entity with id + all fields + timestamps", () => {
    const farm = Farm.create(baseInput);
    expect(farm.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(farm.name).toBe(baseInput.name);
    expect(farm.location).toBe(baseInput.location);
    expect(farm.memberId).toBe(baseInput.memberId);
    expect(farm.organizationId).toBe(baseInput.organizationId);
    expect(farm.createdAt).toEqual(new Date("2026-05-10T12:00:00Z"));
    expect(farm.updatedAt).toEqual(new Date("2026-05-10T12:00:00Z"));
  });

  // α7
  it("Farm getters expose all props", () => {
    const farm = Farm.create(baseInput);
    expect(typeof farm.id).toBe("string");
    expect(farm.name).toBe(baseInput.name);
    expect(farm.location).toBe(baseInput.location);
    expect(farm.memberId).toBe(baseInput.memberId);
    expect(farm.organizationId).toBe(baseInput.organizationId);
    expect(farm.createdAt).toBeInstanceOf(Date);
    expect(farm.updatedAt).toBeInstanceOf(Date);
  });

  // α8
  it("Farm.fromPersistence reconstructs entity preserving id + createdAt + null location", () => {
    const props = {
      id: "fixed-id-1",
      name: "Granja Pre",
      location: null,
      memberId: "member-cuid-1",
      organizationId: "org-cuid-1",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-15T00:00:00Z"),
    };
    const farm = Farm.fromPersistence(props);
    expect(farm.id).toBe("fixed-id-1");
    expect(farm.location).toBeNull();
    expect(farm.createdAt).toEqual(new Date("2026-01-01T00:00:00Z"));
    expect(farm.updatedAt).toEqual(new Date("2026-01-15T00:00:00Z"));
  });

  // α9
  it("Farm.update(name) returns NEW entity preserving id + createdAt + refreshes updatedAt", () => {
    const farm = Farm.create(baseInput);
    vi.setSystemTime(new Date("2026-05-11T12:00:00Z"));
    const updated = farm.update({ name: "Granja Renombrada" });
    expect(updated).not.toBe(farm);
    expect(updated.id).toBe(farm.id);
    expect(updated.name).toBe("Granja Renombrada");
    expect(updated.location).toBe(baseInput.location);
    expect(updated.createdAt).toEqual(farm.createdAt);
    expect(updated.updatedAt).toEqual(new Date("2026-05-11T12:00:00Z"));
  });

  // α10
  it("Farm.update partial (only location) preserves name", () => {
    const farm = Farm.create(baseInput);
    const updated = farm.update({ location: "Km 10" });
    expect(updated.name).toBe(baseInput.name);
    expect(updated.location).toBe("Km 10");
  });

  // α11
  it("Farm.toSnapshot serializes all fields", () => {
    const farm = Farm.create(baseInput);
    const snap = farm.toSnapshot();
    expect(snap).toMatchObject({
      id: farm.id,
      name: baseInput.name,
      location: baseInput.location,
      memberId: baseInput.memberId,
      organizationId: baseInput.organizationId,
      createdAt: farm.createdAt,
      updatedAt: farm.updatedAt,
    });
  });
});
