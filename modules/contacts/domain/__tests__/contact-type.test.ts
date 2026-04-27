import { describe, it, expect } from "vitest";
import {
  CONTACT_TYPES,
  ContactType,
  parseContactType,
} from "../value-objects/contact-type";
import { InvalidContactType } from "../errors/contact-errors";

describe("ContactType", () => {
  it("exposes the full set of valid values", () => {
    expect(CONTACT_TYPES).toEqual([
      "CLIENTE",
      "PROVEEDOR",
      "SOCIO",
      "TRANSPORTISTA",
      "OTRO",
    ]);
  });

  it.each(CONTACT_TYPES)("parses %s as a valid ContactType", (value) => {
    expect(parseContactType(value)).toBe(value);
  });

  it("rejects an unknown string", () => {
    expect(() => parseContactType("EMPLEADO" as ContactType)).toThrow(
      InvalidContactType,
    );
  });

  it("rejects an empty string", () => {
    expect(() => parseContactType("" as ContactType)).toThrow(InvalidContactType);
  });

  it("rejects a non-string value", () => {
    expect(() =>
      parseContactType(123 as unknown as ContactType),
    ).toThrow(InvalidContactType);
  });
});
