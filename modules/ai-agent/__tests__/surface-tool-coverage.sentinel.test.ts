import { describe, expect, it } from "vitest";
import { TOOL_REGISTRY } from "../domain/tools/agent.tool-definitions.ts";
import { SURFACE_REGISTRY, SURFACES } from "../domain/tools/surfaces/index.ts";

// REQ-7 / D5 sentinel — prevents drift where a tool is added to
// TOOL_REGISTRY but forgotten in surface bundles. Direct runtime-graph
// check (NOT readFileSync) per design D5.3 — fewer false positives than
// filesystem glob, no CI working-directory sensitivity.

describe("sentinel: every TOOL_REGISTRY tool belongs to ≥1 surface bundle", () => {
  it("TOOL_REGISTRY ⊆ ⋃ bundles[*].tools (by name)", () => {
    const coveredNames = new Set(
      SURFACES.flatMap((s) => SURFACE_REGISTRY[s].tools.map((t) => t.name)),
    );
    const orphans = Object.keys(TOOL_REGISTRY).filter(
      (n) => !coveredNames.has(n),
    );
    expect(
      orphans,
      `Orphan tools (not in any surface bundle): ${orphans.join(", ")}`,
    ).toEqual([]);
  });
});
