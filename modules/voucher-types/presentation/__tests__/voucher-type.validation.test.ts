import { describe, it, expect } from "vitest";
import {
  createVoucherTypeSchema,
  updateVoucherTypeSchema,
} from "../voucher-type.validation";

describe("createVoucherTypeSchema", () => {
  it("rejects unknown keys (strict)", () => {
    expect(
      createVoucherTypeSchema.safeParse({
        code: "CI",
        name: "Ingreso",
        prefix: "I",
        organizationId: "hacker",
      }).success,
    ).toBe(false);
  });

  it("accepts valid input", () => {
    expect(
      createVoucherTypeSchema.safeParse({
        code: "CI",
        name: "Ingreso",
        prefix: "I",
      }).success,
    ).toBe(true);
  });
});

describe("updateVoucherTypeSchema", () => {
  it("rejects unknown key `code` (immutable post-create)", () => {
    expect(updateVoucherTypeSchema.safeParse({ code: "CX" }).success).toBe(false);
  });

  it("rejects unknown key `organizationId`", () => {
    expect(
      updateVoucherTypeSchema.safeParse({
        name: "ok",
        organizationId: "hacker",
      }).success,
    ).toBe(false);
  });

  it("accepts editing name + prefix + isActive", () => {
    expect(
      updateVoucherTypeSchema.safeParse({
        name: "Nuevo",
        prefix: "X",
        isActive: false,
      }).success,
    ).toBe(true);
  });
});
