import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LOT_ROOT = resolve(__dirname, "..");

function readLotFile(rel: string): string {
  return readFileSync(resolve(LOT_ROOT, rel), "utf-8");
}

describe("C0 domain shape — Lot module (existence-only regex)", () => {
  // α12
  it("Lot entity is exported from domain/lot.entity.ts", () => {
    const src = readLotFile("domain/lot.entity.ts");
    expect(src).toMatch(/^export class Lot\b/m);
  });

  // α13
  it("LotStatus + parseLotStatus + canTransitionLot + LOT_STATUSES are exported from domain/value-objects/lot-status.ts", () => {
    const src = readLotFile("domain/value-objects/lot-status.ts");
    expect(src).toMatch(/^export type LotStatus\b/m);
    expect(src).toMatch(/^export (function|const) parseLotStatus\b/m);
    expect(src).toMatch(/^export (function|const) canTransitionLot\b/m);
    expect(src).toMatch(/^export const LOT_STATUSES\b/m);
  });

  // α14
  it("LotSummary VO is exported from domain/value-objects/lot-summary.ts", () => {
    const src = readLotFile("domain/value-objects/lot-summary.ts");
    expect(src).toMatch(/^export class LotSummary\b/m);
  });

  // α15
  it("LotRepository type is exported from domain/lot.repository.ts", () => {
    const src = readLotFile("domain/lot.repository.ts");
    expect(src).toMatch(/^export (interface|type) LotRepository\b/m);
  });

  // α16
  it("LotExistencePort + LotSnapshot types are exported from domain/ports/lot-existence.port.ts (mortality C6 reuse)", () => {
    const src = readLotFile("domain/ports/lot-existence.port.ts");
    expect(src).toMatch(/^export (interface|type) LotExistencePort\b/m);
    expect(src).toMatch(/^export (interface|type) LotSnapshot\b/m);
  });

  // α17
  it("CannotCloseInactiveLot + InvalidLotStatusTransition + InvalidLotStatus errors are exported from domain/errors/lot-errors.ts", () => {
    const src = readLotFile("domain/errors/lot-errors.ts");
    expect(src).toMatch(/^export class CannotCloseInactiveLot\b/m);
    expect(src).toMatch(/^export class InvalidLotStatusTransition\b/m);
    expect(src).toMatch(/^export class InvalidLotStatus\b/m);
  });

  // α18
  it("CreateLotInput + CloseLotInput + LotProps + LotSnapshot are exported from domain/lot.entity.ts", () => {
    const src = readLotFile("domain/lot.entity.ts");
    expect(src).toMatch(/^export (interface|type) CreateLotInput\b/m);
    expect(src).toMatch(/^export (interface|type) CloseLotInput\b/m);
    expect(src).toMatch(/^export (interface|type) LotProps\b/m);
    expect(src).toMatch(/^export (interface|type) LotSnapshot\b/m);
  });

  // α19
  it("Lot.create + Lot.fromPersistence static factories exist in domain/lot.entity.ts", () => {
    const src = readLotFile("domain/lot.entity.ts");
    expect(src).toMatch(/static create\(/m);
    expect(src).toMatch(/static fromPersistence\(/m);
  });

  // α20
  it("LotSummary.compute static factory exists in domain/value-objects/lot-summary.ts", () => {
    const src = readLotFile("domain/value-objects/lot-summary.ts");
    expect(src).toMatch(/static compute\(/m);
  });
});
