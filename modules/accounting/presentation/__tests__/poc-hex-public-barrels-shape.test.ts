import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ACCOUNTING_ROOT = resolve(__dirname, "../..");

function readAccountingFile(rel: string): string {
  return readFileSync(resolve(ACCOUNTING_ROOT, rel), "utf-8");
}

describe("poc-hex-public-barrels — presentation/server.ts shape (existence-only regex)", () => {
  // α01 — accounting server.ts exists
  it("accounting: server.ts file exists", () => {
    const src = readAccountingFile("presentation/server.ts");
    expect(src).toBeDefined();
  });

  // α02 — accounting server.ts line 1 = import "server-only";
  it('accounting: server.ts line 1 is exactly import "server-only";', () => {
    const src = readAccountingFile("presentation/server.ts");
    expect(src).toMatch(/^import "server-only";$/m);
    expect(src.split("\n")[0]).toBe('import "server-only";');
  });

  // α03 — accounting server.ts exports makeJournalsService from ./composition-root
  it("accounting: server.ts exports makeJournalsService from ./composition-root", () => {
    const src = readAccountingFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bmakeJournalsService\b[^}]*\}\s*from\s*["']\.\/composition-root["']/m,
    );
  });

  // α04 — accounting server.ts exports JournalsService from ../application/journals.service
  it("accounting: server.ts exports JournalsService from ../application/journals.service", () => {
    const src = readAccountingFile("presentation/server.ts");
    expect(src).toMatch(
      /^export\s*\{[^}]*\bJournalsService\b[^}]*\}\s*from\s*["']\.\.\/application\/journals\.service["']/m,
    );
  });
  // α05–α08 (iva-books sentinels) retired in lcv-feature-retirement —
  // modules/iva-books/ deleted entirely (RND 102100000011, Bolivia SIN → RCV).
});
