import { describe, it, expect } from "vitest";
import {
  IVA_SALES_ESTADOS_SIN,
  type IvaSalesEstadoSIN,
  parseIvaSalesEstadoSIN,
} from "../../value-objects/iva-sales-estado-sin";
import { InvalidIvaSalesEstadoSIN } from "../../errors/iva-book-errors";

describe("IvaSalesEstadoSIN", () => {
  it("expone el set completo de estados SIN válidos en orden Prisma", () => {
    expect(IVA_SALES_ESTADOS_SIN).toEqual(["A", "V", "C", "L"]);
  });

  it.each(IVA_SALES_ESTADOS_SIN)(
    "parsea %s como IvaSalesEstadoSIN válido",
    (value) => {
      expect(parseIvaSalesEstadoSIN(value)).toBe(value);
    },
  );

  it("rechaza un string desconocido", () => {
    expect(() =>
      parseIvaSalesEstadoSIN("X" as IvaSalesEstadoSIN),
    ).toThrow(InvalidIvaSalesEstadoSIN);
  });

  it("rechaza un string vacío", () => {
    expect(() => parseIvaSalesEstadoSIN("" as IvaSalesEstadoSIN)).toThrow(
      InvalidIvaSalesEstadoSIN,
    );
  });

  it("rechaza un valor no-string", () => {
    expect(() =>
      parseIvaSalesEstadoSIN(1 as unknown as IvaSalesEstadoSIN),
    ).toThrow(InvalidIvaSalesEstadoSIN);
  });

  it("respeta case-sensitivity (solo mayúsculas)", () => {
    expect(() =>
      parseIvaSalesEstadoSIN("a" as IvaSalesEstadoSIN),
    ).toThrow(InvalidIvaSalesEstadoSIN);
  });
});
