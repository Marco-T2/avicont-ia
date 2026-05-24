/**
 * Retirement sentinel — getToolsForRole (agent-surface-separation cleanup).
 *
 * getToolsForRole was @deprecated in favor of getToolsForSurface; its own JSDoc
 * sanctioned the removal ("follow-up cleanup SDD with RED 'no references remain'
 * + GREEN delete + un-export from barrel"). ZERO production callers (verified
 * project-scope). Its private role tool-sets (socioTools/contadorTools/adminTools)
 * were consumed ONLY by getToolsForRole, so they are retired in the same cascade
 * (no orphaned dead code left behind).
 *
 * Failure modes declared (per [[red_acceptance_failure_mode]]) — pre-GREEN:
 *  fn-absent        agent.tool-definitions.ts STILL declares getToolsForRole -> FAIL
 *  rolesets-absent  orphaned socio/contador/adminTools STILL present -> FAIL
 *  barrel-absent    agent.tools.ts STILL re-exports getToolsForRole -> FAIL
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

describe("ai-agent getToolsForRole retirement (agent-surface-separation)", () => {
  it("fn-absent: agent.tool-definitions.ts no longer declares getToolsForRole", () => {
    expect(
      read("modules/ai-agent/domain/tools/agent.tool-definitions.ts"),
    ).not.toMatch(/\bgetToolsForRole\b/);
  });

  it("rolesets-absent: orphaned role tool-sets removed (socio/contador/adminTools)", () => {
    const src = read("modules/ai-agent/domain/tools/agent.tool-definitions.ts");
    expect(src).not.toMatch(/\bsocioTools\b/);
    expect(src).not.toMatch(/\bcontadorTools\b/);
    expect(src).not.toMatch(/\badminTools\b/);
  });

  it("barrel-absent: agent.tools.ts no longer re-exports getToolsForRole", () => {
    expect(read("modules/ai-agent/application/agent.tools.ts")).not.toMatch(
      /\bgetToolsForRole\b/,
    );
  });
});
