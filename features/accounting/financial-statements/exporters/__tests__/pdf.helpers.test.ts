import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { fmtDecimal } from "../pdf.helpers";

describe("fmtDecimal", () => {
  it("returns empty string for zero when isTotal=false", () => {
    expect(fmtDecimal(new Prisma.Decimal(0), false)).toBe("");
  });

  it('returns "0,00" for zero when isTotal=true', () => {
    expect(fmtDecimal(new Prisma.Decimal(0), true)).toBe("0,00");
  });

  it("wraps negative values in parentheses (no minus sign)", () => {
    expect(fmtDecimal(new Prisma.Decimal(-1234.56), false)).toBe("(1.234,56)");
    expect(fmtDecimal(new Prisma.Decimal(-1234.56), true)).toBe("(1.234,56)");
  });

  it("formats positive values with es-BO thousands separator and 2 decimals", () => {
    expect(fmtDecimal(new Prisma.Decimal(1234.56), false)).toBe("1.234,56");
    expect(fmtDecimal(new Prisma.Decimal(1234.56), true)).toBe("1.234,56");
  });

  it("pads to 2 decimals when input has fewer", () => {
    expect(fmtDecimal(new Prisma.Decimal(100), false)).toBe("100,00");
  });

  it("handles large numbers with multiple thousands separators", () => {
    expect(fmtDecimal(new Prisma.Decimal(1234567.89), false)).toBe("1.234.567,89");
  });
});
