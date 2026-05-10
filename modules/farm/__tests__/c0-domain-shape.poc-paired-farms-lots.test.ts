import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FARM_ROOT = resolve(__dirname, "..");

function readFarmFile(rel: string): string {
  return readFileSync(resolve(FARM_ROOT, rel), "utf-8");
}

describe("C0 domain shape — Farm module (existence-only regex)", () => {
  // α1
  it("Farm entity is exported from domain/farm.entity.ts", () => {
    const src = readFarmFile("domain/farm.entity.ts");
    expect(src).toMatch(/^export class Farm\b/m);
  });

  // α2
  it("FarmRepository type is exported from domain/farm.repository.ts", () => {
    const src = readFarmFile("domain/farm.repository.ts");
    expect(src).toMatch(/^export (interface|type) FarmRepository\b/m);
  });

  // α3
  it("FarmAlreadyExists error is exported from domain/errors/farm-errors.ts", () => {
    const src = readFarmFile("domain/errors/farm-errors.ts");
    expect(src).toMatch(/^export class FarmAlreadyExists\b/m);
  });

  // α4
  it("CreateFarmInput + UpdateFarmInput + FarmProps + FarmSnapshot types are exported from domain/farm.entity.ts", () => {
    const src = readFarmFile("domain/farm.entity.ts");
    expect(src).toMatch(/^export (interface|type) CreateFarmInput\b/m);
    expect(src).toMatch(/^export (interface|type) UpdateFarmInput\b/m);
    expect(src).toMatch(/^export (interface|type) FarmProps\b/m);
    expect(src).toMatch(/^export (interface|type) FarmSnapshot\b/m);
  });

  // α5
  it("Farm.create + Farm.fromPersistence static factories exist in domain/farm.entity.ts", () => {
    const src = readFarmFile("domain/farm.entity.ts");
    expect(src).toMatch(/static create\(/m);
    expect(src).toMatch(/static fromPersistence\(/m);
  });
});
