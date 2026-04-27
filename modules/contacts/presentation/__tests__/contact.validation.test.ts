import { describe, it, expect } from "vitest";
import {
  contactFiltersSchema,
  createContactSchema,
  updateContactSchema,
} from "../contact.validation";

describe("createContactSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = createContactSchema.parse({
      type: "CLIENTE",
      name: "Acme",
    });
    expect(result).toEqual({ type: "CLIENTE", name: "Acme" });
  });

  it("rejects an unknown type", () => {
    expect(() =>
      createContactSchema.parse({ type: "EMPLEADO", name: "X" }),
    ).toThrow();
  });

  it("rejects an empty name", () => {
    expect(() =>
      createContactSchema.parse({ type: "CLIENTE", name: "" }),
    ).toThrow();
  });

  it("rejects a NIT longer than 20 chars", () => {
    expect(() =>
      createContactSchema.parse({
        type: "CLIENTE",
        name: "X",
        nit: "1".repeat(21),
      }),
    ).toThrow();
  });

  it("rejects payment terms outside 0..365", () => {
    expect(() =>
      createContactSchema.parse({
        type: "CLIENTE",
        name: "X",
        paymentTermsDays: 400,
      }),
    ).toThrow();
  });

  it("accepts a creditLimit of null", () => {
    const result = createContactSchema.parse({
      type: "CLIENTE",
      name: "X",
      creditLimit: null,
    });
    expect(result.creditLimit).toBeNull();
  });
});

describe("updateContactSchema", () => {
  it("accepts an empty object", () => {
    expect(updateContactSchema.parse({})).toEqual({});
  });

  it("accepts null for nullable fields", () => {
    const result = updateContactSchema.parse({
      nit: null,
      email: null,
      phone: null,
      address: null,
      creditLimit: null,
    });
    expect(result).toEqual({
      nit: null,
      email: null,
      phone: null,
      address: null,
      creditLimit: null,
    });
  });

  it("rejects invalid email", () => {
    expect(() => updateContactSchema.parse({ email: "not-an-email" })).toThrow();
  });
});

describe("contactFiltersSchema", () => {
  it("accepts an empty object", () => {
    expect(contactFiltersSchema.parse({})).toEqual({});
  });

  it("accepts excludeTypes array", () => {
    expect(
      contactFiltersSchema.parse({ excludeTypes: ["CLIENTE", "OTRO"] }),
    ).toEqual({ excludeTypes: ["CLIENTE", "OTRO"] });
  });

  it("rejects search longer than 100 chars", () => {
    expect(() =>
      contactFiltersSchema.parse({ search: "x".repeat(101) }),
    ).toThrow();
  });
});
