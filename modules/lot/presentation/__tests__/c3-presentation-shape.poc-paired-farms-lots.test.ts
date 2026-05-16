import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LOT_ROOT = resolve(__dirname, "..", "..");

function readLotFile(rel: string): string {
  return readFileSync(resolve(LOT_ROOT, rel), "utf-8");
}

describe("C3 presentation shape — Lot module (existence-only regex)", () => {
  // α9
  it("composition-root.ts exports makeLotService factory", () => {
    const src = readLotFile("presentation/composition-root.ts");
    expect(src).toMatch(/^export function makeLotService\(/m);
  });

  // α10
  it("composition-root.ts factory wires PrismaLotRepository único (no adapter)", () => {
    const src = readLotFile("presentation/composition-root.ts");
    expect(src).toMatch(/new PrismaLotRepository\(/);
    expect(src).not.toMatch(/Adapter\(/);
  });

  // α11
  it("validation.ts exports createLotSchema (Zod)", () => {
    const src = readLotFile("presentation/validation.ts");
    expect(src).toMatch(/^export const createLotSchema\s*=\s*z\.object\(/m);
  });

  // α12
  it("validation.ts exports closeLotSchema (Zod)", () => {
    const src = readLotFile("presentation/validation.ts");
    expect(src).toMatch(/^export const closeLotSchema\s*=\s*z\.object\(/m);
  });

  // α13 — REVOKED per ZID-1 (sdd/poc-zod-id-validators-domain-alignment).
  // Original D5 lock: farmId.cuid() EXACT legacy preservation. Revoked because
  // domain entities generate UUIDs via crypto.randomUUID(), and .cuid() rejected
  // those at the presentation boundary causing 400s for UI-created records.
  // New EXACT lock per ZID-1: farmId.min(1, ...) — format-agnostic.
  // Original assertion preserved here as historical reference (commented):
  //   expect(src).toMatch(/farmId:\s*z\.string\(\)\.cuid\(/);  // ← REVOKED
  it("validation.ts uses farmId.min(1) per ZID-1 (Derived from: D5 lock REVOKED)", () => {
    const src = readLotFile("presentation/validation.ts");
    expect(src).toMatch(/farmId:\s*z\.string\(\)\.min\(1,/);
    expect(src).not.toMatch(/farmId:\s*z\.string\(\)\.cuid\(/);
  });

  // α14
  it("server.ts barrel re-exports makeLotService from composition-root", () => {
    const src = readLotFile("presentation/server.ts");
    expect(src).toMatch(/^export\s*\{\s*makeLotService\b[\s\S]*?\}\s*from\s*["']\.\/composition-root["']/m);
  });

  // α15
  it("server.ts barrel re-exports createLotSchema + closeLotSchema from validation", () => {
    const src = readLotFile("presentation/server.ts");
    expect(src).toMatch(/^export\s*\{\s*createLotSchema\b/m);
    expect(src).toMatch(/\bcloseLotSchema\b[\s\S]*?\}\s*from\s*["']\.\/validation["']/m);
  });

  // α16
  it("server.ts barrel re-exports LotSnapshot + LotWithRelationsSnapshot + LotSummary types", () => {
    const src = readLotFile("presentation/server.ts");
    expect(src).toMatch(/\bLotSnapshot\b/);
    expect(src).toMatch(/\bLotWithRelationsSnapshot\b/);
    expect(src).toMatch(/\bLotSummary\b/);
  });

  // α17
  it("server.ts barrel re-exports Lot entity + LotService + LotStatus", () => {
    const src = readLotFile("presentation/server.ts");
    expect(src).toMatch(/\bLot\b[\s\S]*?from\s*["']\.\.\/domain\/lot\.entity["']/);
    expect(src).toMatch(/\bLotService\b[\s\S]*?from\s*["']\.\.\/application\/lot\.service["']/);
    expect(src).toMatch(/\bLotStatus\b/);
  });
});
