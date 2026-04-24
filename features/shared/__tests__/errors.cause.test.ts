/**
 * RED test — Audit H WARNING (d): AppError y ConflictError preservan `cause`
 * al forwardearlo a `Error` nativo via `super(message, { cause })`.
 *
 * Expected failure mode en RED:
 *   - Assertions `expect(err.cause).toBe(original)` fallan con `undefined`,
 *     porque el constructor actual llama `super(message)` sin forwardear
 *     el options-bag a `Error`.
 *   - Las marcas `@ts-expect-error` se eliminan en GREEN cuando la firma
 *     acepta el parámetro opcional `cause`.
 */
import { describe, it, expect } from "vitest";
import { AppError, ConflictError } from "@/features/shared/errors";

describe("AppError — cause preservation (Audit H WARNING d)", () => {
  it("forwardea cause al Error nativo cuando se pasa", () => {
    const original = new Error("boom at DB layer");
    const err = new AppError(
      "Wrapper message",
      500,
      "WRAP_CODE",
      undefined,
      original,
    );

    expect(err.cause).toBe(original);
  });

  it("cause es undefined cuando no se pasa", () => {
    const err = new AppError("No cause here", 500, "CODE");
    expect(err.cause).toBeUndefined();
  });

  it("preserva stack del original via Error.cause chain", () => {
    const original = new Error("root cause");
    const err = new AppError(
      "Wrapper",
      500,
      "CODE",
      undefined,
      original,
    );

    // Node serializa err.cause.stack cuando se hace console.error(err) o
    // inspect. Al chequear la cadena directa confirmamos que cause está
    // colgado del Error nativo (no una prop ad-hoc en AppError).
    expect((err.cause as Error).stack).toBe(original.stack);
  });
});

describe("ConflictError — cause preservation (Audit H WARNING d)", () => {
  it("forwardea cause al AppError base cuando se pasa como 4to arg", () => {
    const prismaLike = new Error("P2002 unique violation");
    const err = new ConflictError(
      "Factura",
      "CONFLICT",
      undefined,
      prismaLike,
    );

    expect(err.cause).toBe(prismaLike);
  });

  it("cause es undefined cuando no se pasa (retrocompatibilidad)", () => {
    const err = new ConflictError("Factura");
    expect(err.cause).toBeUndefined();
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});
