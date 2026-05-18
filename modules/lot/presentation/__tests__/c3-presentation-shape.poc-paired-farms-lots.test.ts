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

  // α12 — post-collapse REQ-203/D-4: deactivateLotSchema is the canonical
  // export; closeLotSchema is a deprecated alias kept for transitional
  // imports (deletion paired with F5 T29 retirement of these POC tests).
  it("validation.ts exports deactivateLotSchema (Zod) + closeLotSchema alias", () => {
    const src = readLotFile("presentation/validation.ts");
    expect(src).toMatch(/^export const deactivateLotSchema\s*=\s*z\.object\(/m);
    expect(src).toMatch(/^export const closeLotSchema\s*=\s*deactivateLotSchema\b/m);
  });

  // α13 — post-collapse REQ-200: farmId dropped; createLotSchema now
  // exposes `farmName` (free-text label). Original ZID-1 farmId.min(1)
  // assertion retired by the SDD retire-farm-collapse-to-lot proposal.
  it("validation.ts uses farmName (post-collapse REQ-200, supersedes ZID-1 farmId.min)", () => {
    const src = readLotFile("presentation/validation.ts");
    expect(src).toMatch(/farmName:\s*z\s*\n?\s*\.string\(\)\s*\n?\s*\.min\(1,/);
    expect(src).not.toMatch(/farmId:\s*z\.string\(/);
  });

  // α14
  it("server.ts barrel re-exports makeLotService from composition-root", () => {
    const src = readLotFile("presentation/server.ts");
    expect(src).toMatch(/^export\s*\{\s*makeLotService\b[\s\S]*?\}\s*from\s*["']\.\/composition-root["']/m);
  });

  // α15 — barrel still re-exports closeLotSchema as deprecated alias
  it("server.ts barrel re-exports createLotSchema + deactivateLotSchema + closeLotSchema from validation", () => {
    const src = readLotFile("presentation/server.ts");
    expect(src).toMatch(/^export\s*\{\s*\n?\s*createLotSchema\b/m);
    expect(src).toMatch(/\bdeactivateLotSchema\b/);
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
