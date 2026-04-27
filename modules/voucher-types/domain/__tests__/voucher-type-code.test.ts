import { describe, it, expect } from "vitest";
import { VoucherTypeCode } from "../value-objects/voucher-type-code";
import { InvalidVoucherTypeCodeFormat } from "../errors/voucher-type-errors";

describe("VoucherTypeCode.of", () => {
  it("accepts a 2-char A-Z code", () => {
    expect(VoucherTypeCode.of("CI").value).toBe("CI");
  });

  it("accepts a 6-char A-Z0-9 code", () => {
    expect(VoucherTypeCode.of("CTR123").value).toBe("CTR123");
  });

  it("rejects 1-char code (too short)", () => {
    expect(() => VoucherTypeCode.of("A")).toThrow(InvalidVoucherTypeCodeFormat);
  });

  it("rejects 7-char code (too long)", () => {
    expect(() => VoucherTypeCode.of("ABCDEFG")).toThrow(
      InvalidVoucherTypeCodeFormat,
    );
  });

  it("rejects lowercase code", () => {
    expect(() => VoucherTypeCode.of("ci")).toThrow(InvalidVoucherTypeCodeFormat);
  });

  it("rejects code with special chars", () => {
    expect(() => VoucherTypeCode.of("C-I")).toThrow(
      InvalidVoucherTypeCodeFormat,
    );
  });

  it("rejects empty string", () => {
    expect(() => VoucherTypeCode.of("")).toThrow(InvalidVoucherTypeCodeFormat);
  });
});

describe("VoucherTypeCode.equals", () => {
  it("returns true for identical codes", () => {
    expect(VoucherTypeCode.of("CI").equals(VoucherTypeCode.of("CI"))).toBe(true);
  });

  it("returns false for different codes", () => {
    expect(VoucherTypeCode.of("CI").equals(VoucherTypeCode.of("CE"))).toBe(false);
  });
});

describe("VoucherTypeCode.toString", () => {
  it("returns the underlying value", () => {
    expect(VoucherTypeCode.of("CT").toString()).toBe("CT");
  });
});
