import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FARM_ROOT = resolve(__dirname, "..", "..");

function readFarmFile(rel: string): string {
  return readFileSync(resolve(FARM_ROOT, rel), "utf-8");
}

describe("C3 presentation shape — Farm module (existence-only regex)", () => {
  // α1
  it("composition-root.ts exports makeFarmService factory", () => {
    const src = readFarmFile("presentation/composition-root.ts");
    expect(src).toMatch(/^export function makeFarmService\(/m);
  });

  // α2
  it("composition-root.ts factory wires PrismaFarmRepository", () => {
    const src = readFarmFile("presentation/composition-root.ts");
    expect(src).toMatch(/new PrismaFarmRepository\(/);
  });

  // α3
  it("composition-root.ts factory wires LocalMemberInquiryAdapter", () => {
    const src = readFarmFile("presentation/composition-root.ts");
    expect(src).toMatch(/new LocalMemberInquiryAdapter\(/);
  });

  // α4
  it("validation.ts exports createFarmSchema (Zod)", () => {
    const src = readFarmFile("presentation/validation.ts");
    expect(src).toMatch(/^export const createFarmSchema\s*=\s*z\.object\(/m);
  });

  // α5
  it("validation.ts exports updateFarmSchema (Zod)", () => {
    const src = readFarmFile("presentation/validation.ts");
    expect(src).toMatch(/^export const updateFarmSchema\s*=\s*z\.object\(/m);
  });

  // α6
  it("server.ts barrel re-exports makeFarmService from composition-root", () => {
    const src = readFarmFile("presentation/server.ts");
    expect(src).toMatch(/^export\s*\{\s*makeFarmService\b[\s\S]*?\}\s*from\s*["']\.\/composition-root["']/m);
  });

  // α7
  it("server.ts barrel re-exports createFarmSchema + updateFarmSchema from validation", () => {
    const src = readFarmFile("presentation/server.ts");
    expect(src).toMatch(/^export\s*\{\s*createFarmSchema\b/m);
    expect(src).toMatch(/\bupdateFarmSchema\b[\s\S]*?\}\s*from\s*["']\.\/validation["']/m);
  });

  // α8
  it("server.ts barrel re-exports Farm entity + FarmService + FarmSnapshot types", () => {
    const src = readFarmFile("presentation/server.ts");
    expect(src).toMatch(/\bFarm\b[\s\S]*?from\s*["']\.\.\/domain\/farm\.entity["']/);
    expect(src).toMatch(/\bFarmService\b[\s\S]*?from\s*["']\.\.\/application\/farm\.service["']/);
    expect(src).toMatch(/\bFarmSnapshot\b/);
  });
});
