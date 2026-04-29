import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";

/**
 * Payment composition root wiring — POC #10 sub-fase D Ciclo 2 atomic
 * cutover + E-1 cleanup. Static text + fs.existsSync ground-truth for the
 * adapter swap. Behavior is covered by the 4 integration tests of Ciclo 1.
 */

const compRootPath = path.resolve(__dirname, "../composition-root.ts");
const legacyAdapterPath = path.resolve(
  __dirname,
  "../../infrastructure/adapters/legacy-account-balances.adapter.ts",
);

describe("payment composition root — D Ciclo 2 cutover + E-1 cleanup", () => {
  it("wires PrismaAccountBalancesAdapter, drops LegacyAccountBalancesAdapter, deletes legacy file", () => {
    const source = fs.readFileSync(compRootPath, "utf8");

    expect(source).toContain("PrismaAccountBalancesAdapter");
    expect(source).not.toContain("LegacyAccountBalancesAdapter");
    expect(fs.existsSync(legacyAdapterPath)).toBe(false);
  });
});
