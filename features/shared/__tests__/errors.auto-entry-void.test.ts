/**
 * T1.1 RED — AUTO_ENTRY_VOID_FORBIDDEN error code shape
 *
 * Verifica que la constante exista y tenga el valor exacto esperado.
 * RED: fallará hasta que T1.2 la agregue a errors.ts.
 */
import { describe, it, expect } from "vitest";

describe("AUTO_ENTRY_VOID_FORBIDDEN", () => {
  it("existe como export nombrado de features/shared/errors", async () => {
    const errors = await import("@/features/shared/errors");
    expect(errors).toHaveProperty("AUTO_ENTRY_VOID_FORBIDDEN");
  });

  it("tiene el valor de string correcto", async () => {
    const { AUTO_ENTRY_VOID_FORBIDDEN } = await import(
      "@/features/shared/errors"
    );
    expect(AUTO_ENTRY_VOID_FORBIDDEN).toBe("AUTO_ENTRY_VOID_FORBIDDEN");
  });

  it("es un string (no undefined, no null, no number)", async () => {
    const { AUTO_ENTRY_VOID_FORBIDDEN } = await import(
      "@/features/shared/errors"
    );
    expect(typeof AUTO_ENTRY_VOID_FORBIDDEN).toBe("string");
  });
});
