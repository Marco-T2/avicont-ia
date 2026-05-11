import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PRODUCT_TYPE_ROOT = resolve(__dirname, "..");

function readProductTypeFile(rel: string): string {
  return readFileSync(resolve(PRODUCT_TYPE_ROOT, rel), "utf-8");
}

describe("C0 domain shape — ProductType module (existence-only regex)", () => {
  // α1 — paired sister OperationalDocType α1 EXACT mirror
  it("ProductType entity is exported from domain/product-type.entity.ts", () => {
    const src = readProductTypeFile("domain/product-type.entity.ts");
    expect(src).toMatch(/^export class ProductType\b/m);
  });

  // α2 — paired sister OperationalDocType α3 EXACT mirror (write-tx port R7 paired sister cementado)
  it("ProductTypesRepository type is exported from domain/product-type.repository.ts (write-tx port R7 paired sister cementado)", () => {
    const src = readProductTypeFile("domain/product-type.repository.ts");
    expect(src).toMatch(
      /^export (interface|type) ProductTypesRepository\b/m,
    );
  });

  // α3 — paired sister OperationalDocType α4 EXACT mirror (D3 Opt A R7 read-non-tx separation)
  it("ProductTypesInquiryPort + ProductTypeSnapshot types are exported from domain/ports/product-type-inquiry.port.ts (read-non-tx port R7 paired sister cementado)", () => {
    const src = readProductTypeFile(
      "domain/ports/product-type-inquiry.port.ts",
    );
    expect(src).toMatch(
      /^export (interface|type) ProductTypesInquiryPort\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) ProductTypeSnapshot\b/m,
    );
  });

  // α4 — paired sister OperationalDocType α5 REDUCED honest (2 errors vs ODT 3) — NO InUse guard in legacy service
  it("ProductTypeNotFoundError + ProductTypeDuplicateCodeError errors are exported from domain/errors/product-type-errors.ts (α4 REDUCED honest paired sister OperationalDocType 3 errors → 2 errors — NO InUse guard legacy)", () => {
    const src = readProductTypeFile(
      "domain/errors/product-type-errors.ts",
    );
    expect(src).toMatch(/^export class ProductTypeNotFoundError\b/m);
    expect(src).toMatch(/^export class ProductTypeDuplicateCodeError\b/m);
  });

  // α5 — paired sister OperationalDocType α6 EXACT mirror (3 types)
  it("CreateProductTypeInput + ProductTypeProps + ProductTypeSnapshot are exported from domain/product-type.entity.ts", () => {
    const src = readProductTypeFile("domain/product-type.entity.ts");
    expect(src).toMatch(
      /^export (interface|type) CreateProductTypeInput\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) ProductTypeProps\b/m,
    );
    expect(src).toMatch(
      /^export (interface|type) ProductTypeSnapshot\b/m,
    );
  });

  // α6 — paired sister OperationalDocType α7 EXACT mirror
  it("ProductType.create + ProductType.fromPersistence static factories exist in domain/product-type.entity.ts", () => {
    const src = readProductTypeFile("domain/product-type.entity.ts");
    expect(src).toMatch(/static create\(/m);
    expect(src).toMatch(/static fromPersistence\(/m);
  });
});
