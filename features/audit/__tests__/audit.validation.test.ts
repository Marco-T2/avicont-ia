import { describe, it, expect } from "vitest";
import { parseCursor } from "../audit.validation";
import { ValidationError, AUDIT_CURSOR_INVALID } from "@/features/shared/errors";

describe("parseCursor — happy path", () => {
  it("decodea un base64url de { createdAt, id } válido", () => {
    const raw = Buffer.from(
      JSON.stringify({ createdAt: "2026-04-24T10:00:00.000Z", id: "cl_abc" }),
    ).toString("base64url");

    expect(parseCursor(raw)).toEqual({
      createdAt: "2026-04-24T10:00:00.000Z",
      id: "cl_abc",
    });
  });
});

describe("parseCursor — rechazos", () => {
  it("lanza ValidationError AUDIT_CURSOR_INVALID cuando el base64 es malformado", () => {
    try {
      parseCursor("###not-base64url###");
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).code).toBe(AUDIT_CURSOR_INVALID);
    }
  });

  it("lanza ValidationError cuando el JSON decodeado no tiene la shape { createdAt, id }", () => {
    const bad = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    try {
      parseCursor(bad);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).code).toBe(AUDIT_CURSOR_INVALID);
    }
  });

  it("lanza ValidationError cuando id no es string", () => {
    const bad = Buffer.from(
      JSON.stringify({ createdAt: "2026-04-24T10:00:00.000Z", id: 123 }),
    ).toString("base64url");
    try {
      parseCursor(bad);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).code).toBe(AUDIT_CURSOR_INVALID);
    }
  });
});
