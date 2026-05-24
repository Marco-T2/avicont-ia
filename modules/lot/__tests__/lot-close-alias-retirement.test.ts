/**
 * Retirement sentinel — CloseLot* legacy aliases (REQ-203 / D-4 collapse).
 *
 * The binary lifecycle collapse renamed close -> deactivate. The legacy aliases
 * (CloseLotServiceInput, CloseLotInput, closeLotSchema) were kept @deprecated
 * with ZERO remaining consumers (verified via project-scope grep). This sentinel
 * locks their ABSENCE post-retirement, mirroring the repo retirement convention
 * ([[c1-hubservice-retirement]], c7-wholesale-delete-shape): delete + absence
 * sentinel.
 *
 * Failure modes declared (per [[red_acceptance_failure_mode]]) — pre-GREEN:
 *  decl-service-absent  lot.service.ts STILL declares CloseLotServiceInput -> MATCH -> FAIL
 *  decl-entity-absent   lot.entity.ts STILL declares CloseLotInput -> MATCH -> FAIL
 *  decl-schema-absent   validation.ts STILL declares closeLotSchema -> MATCH -> FAIL
 *  barrel-export-absent server.ts STILL re-exports the 3 -> MATCH -> FAIL
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("lot CloseLot* alias retirement (REQ-203 / D-4)", () => {
  it("decl-service-absent: lot.service.ts no longer declares CloseLotServiceInput", () => {
    expect(read("modules/lot/application/lot.service.ts")).not.toMatch(
      /\bCloseLotServiceInput\b/,
    );
  });

  it("decl-entity-absent: lot.entity.ts no longer declares CloseLotInput", () => {
    expect(read("modules/lot/domain/lot.entity.ts")).not.toMatch(
      /\bCloseLotInput\b/,
    );
  });

  it("decl-schema-absent: validation.ts no longer declares closeLotSchema", () => {
    expect(read("modules/lot/presentation/validation.ts")).not.toMatch(
      /\bcloseLotSchema\b/,
    );
  });

  it("barrel-export-absent: server.ts no longer re-exports the 3 legacy aliases", () => {
    const src = read("modules/lot/presentation/server.ts");
    expect(src).not.toMatch(/\bCloseLotServiceInput\b/);
    expect(src).not.toMatch(/\bCloseLotInput\b/);
    expect(src).not.toMatch(/\bcloseLotSchema\b/);
  });
});
