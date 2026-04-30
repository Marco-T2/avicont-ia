import { describe, it, expect } from "vitest";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  FISCAL_PERIOD_CLOSED,
} from "@/features/shared/errors";
import {
  IvaBookFiscalPeriodClosed,
  IvaBookNotFound,
  IvaBookConflict,
  IvaBookReactivateNonVoided,
  IVA_BOOK_DUPLICATE,
  IVA_BOOK_REACTIVATE_NON_VOIDED,
} from "../errors/iva-book-errors";

describe("IvaBookFiscalPeriodClosed", () => {
  it("extiende ValidationError con code FISCAL_PERIOD_CLOSED (reused shared)", () => {
    const err = new IvaBookFiscalPeriodClosed({
      entityType: "sale",
      operation: "create",
    });
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe(FISCAL_PERIOD_CLOSED);
  });

  it.each([
    [
      { entityType: "sale", operation: "create" },
      "No se puede crear el Libro IVA de una venta contabilizada con período cerrado",
    ],
    [
      { entityType: "sale", operation: "modify" },
      "No se puede modificar el Libro IVA de una venta contabilizada con período cerrado",
    ],
    [
      { entityType: "purchase", operation: "create" },
      "No se puede crear el Libro IVA de una compra contabilizada con período cerrado",
    ],
    [
      { entityType: "purchase", operation: "modify" },
      "No se puede modificar el Libro IVA de una compra contabilizada con período cerrado",
    ],
  ] as const)("genera message bit-exact mirror legacy: %j", (input, expected) => {
    const err = new IvaBookFiscalPeriodClosed(input);
    expect(err.message).toBe(expected);
  });

  it("setea name = IvaBookFiscalPeriodClosed", () => {
    const err = new IvaBookFiscalPeriodClosed({
      entityType: "sale",
      operation: "create",
    });
    expect(err.name).toBe("IvaBookFiscalPeriodClosed");
  });
});

describe("IvaBookNotFound", () => {
  it("extiende NotFoundError", () => {
    const err = new IvaBookNotFound("sale");
    expect(err).toBeInstanceOf(NotFoundError);
  });

  it.each([
    ["sale", "Entrada de Libro de Ventas no encontrado"],
    ["purchase", "Entrada de Libro de Compras no encontrado"],
  ] as const)("entityType %s genera message mirror legacy", (entityType, expected) => {
    const err = new IvaBookNotFound(entityType);
    expect(err.message).toBe(expected);
  });

  it("setea name = IvaBookNotFound", () => {
    const err = new IvaBookNotFound("sale");
    expect(err.name).toBe("IvaBookNotFound");
  });
});

describe("IvaBookConflict", () => {
  it("extiende ConflictError con code IVA_BOOK_DUPLICATE", () => {
    const err = new IvaBookConflict("sale");
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.code).toBe(IVA_BOOK_DUPLICATE);
  });

  it.each([
    ["sale", "Entrada de Libro de Ventas ya existe"],
    ["purchase", "Entrada de Libro de Compras ya existe"],
  ] as const)("entityType %s genera message mirror legacy", (entityType, expected) => {
    const err = new IvaBookConflict(entityType);
    expect(err.message).toBe(expected);
  });

  it("preserva cause si se pasa (mirror legacy handlePrismaError P2002 wrap)", () => {
    const cause = new Error("P2002");
    const err = new IvaBookConflict("sale", cause);
    expect(err.cause).toBe(cause);
  });

  it("setea name = IvaBookConflict", () => {
    const err = new IvaBookConflict("sale");
    expect(err.name).toBe("IvaBookConflict");
  });
});

describe("IvaBookReactivateNonVoided", () => {
  // §13 emergente divergencia: legacy iva-books.repository.ts:476,501 usa
  // `new ConflictError("La entrada ya está activa (status !== VOIDED)")` que
  // genera message buggy "...ya existe". Domain-wise "ya activa" es invariante
  // violada (idempotencia/sanidad guard), no conflict de unicidad.
  // POC #11.0c A1 D-A1#6 Opción B: extends ValidationError + custom code.
  it("extiende ValidationError con code IVA_BOOK_REACTIVATE_NON_VOIDED (§13 divergencia legacy)", () => {
    const err = new IvaBookReactivateNonVoided("sale");
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.code).toBe(IVA_BOOK_REACTIVATE_NON_VOIDED);
  });

  it.each([
    [
      "sale",
      "Entrada de Libro de Ventas ya está activa (status !== VOIDED)",
    ],
    [
      "purchase",
      "Entrada de Libro de Compras ya está activa (status !== VOIDED)",
    ],
  ] as const)(
    "entityType %s genera message limpio (NO 'ya existe' suffix legacy bug)",
    (entityType, expected) => {
      const err = new IvaBookReactivateNonVoided(entityType);
      expect(err.message).toBe(expected);
    },
  );

  it("setea name = IvaBookReactivateNonVoided", () => {
    const err = new IvaBookReactivateNonVoided("sale");
    expect(err.name).toBe("IvaBookReactivateNonVoided");
  });
});
