import { describe, it, expect } from "vitest";
import {
  IVA_BOOK_STATUSES,
  type IvaBookStatus,
  parseIvaBookStatus,
} from "../../value-objects/iva-book-status";
import { InvalidIvaBookStatus } from "../../errors/iva-book-errors";

describe("IvaBookStatus", () => {
  it("expone el set completo de estados válidos en orden Prisma", () => {
    expect(IVA_BOOK_STATUSES).toEqual(["ACTIVE", "VOIDED"]);
  });

  it.each(IVA_BOOK_STATUSES)("parsea %s como IvaBookStatus válido", (value) => {
    expect(parseIvaBookStatus(value)).toBe(value);
  });

  it("rechaza un string desconocido", () => {
    expect(() => parseIvaBookStatus("DRAFT" as IvaBookStatus)).toThrow(
      InvalidIvaBookStatus,
    );
  });

  it("rechaza un string vacío", () => {
    expect(() => parseIvaBookStatus("" as IvaBookStatus)).toThrow(
      InvalidIvaBookStatus,
    );
  });

  it("rechaza un valor no-string", () => {
    expect(() =>
      parseIvaBookStatus(123 as unknown as IvaBookStatus),
    ).toThrow(InvalidIvaBookStatus);
  });
});
