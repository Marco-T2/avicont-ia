import { describe, it, expect } from "vitest";
import { VoucherTypePrefix } from "../value-objects/voucher-type-prefix";
import { InvalidVoucherTypePrefixFormat } from "../errors/voucher-type-errors";

describe("VoucherTypePrefix.of", () => {
  it("accepts a single uppercase letter A-Z", () => {
    expect(VoucherTypePrefix.of("I").value).toBe("I");
  });

  it("accepts a single digit 0-9", () => {
    expect(VoucherTypePrefix.of("9").value).toBe("9");
  });

  it("rejects multi-char prefix", () => {
    expect(() => VoucherTypePrefix.of("II")).toThrow(
      InvalidVoucherTypePrefixFormat,
    );
  });

  it("rejects empty string", () => {
    expect(() => VoucherTypePrefix.of("")).toThrow(
      InvalidVoucherTypePrefixFormat,
    );
  });

  it("rejects lowercase letter", () => {
    expect(() => VoucherTypePrefix.of("i")).toThrow(
      InvalidVoucherTypePrefixFormat,
    );
  });

  it("rejects special char", () => {
    expect(() => VoucherTypePrefix.of("@")).toThrow(
      InvalidVoucherTypePrefixFormat,
    );
  });
});

describe("VoucherTypePrefix.equals", () => {
  it("returns true for identical prefixes", () => {
    expect(VoucherTypePrefix.of("I").equals(VoucherTypePrefix.of("I"))).toBe(
      true,
    );
  });

  it("returns false for different prefixes", () => {
    expect(VoucherTypePrefix.of("I").equals(VoucherTypePrefix.of("E"))).toBe(
      false,
    );
  });
});
