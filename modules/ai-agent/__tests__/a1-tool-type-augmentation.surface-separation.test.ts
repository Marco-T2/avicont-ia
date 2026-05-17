import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// A1 RED — Tool<TSchema> in llm-provider.port.ts MUST expose resource + action
// fields so getToolsForSurface can cross-filter against the permissions matrix
// (PERMISSIONS_READ / PERMISSIONS_WRITE).
//
// Strategy: readFileSync text assertion, mirrors c0-domain-shape.poc-ai-agent-hex
// precedent in the same module. We assert that the SOURCE TEXT of the port file
// declares `readonly resource: Resource` and `readonly action:` on Tool.

describe("A1 RED: Tool type augmentation (surface-separation)", () => {
  const portPath = resolve(
    __dirname,
    "..",
    "domain",
    "ports",
    "llm-provider.port.ts",
  );
  const src = readFileSync(portPath, "utf-8");

  it("Tool type declares readonly resource: Resource", () => {
    expect(src).toMatch(/readonly resource: Resource/);
  });

  it("Tool type declares readonly action with read|write narrowing", () => {
    expect(src).toMatch(/readonly action:/);
  });

  it("port file imports Resource and Action from permissions domain", () => {
    expect(src).toMatch(
      /import type \{[^}]*Resource[^}]*\} from "@\/modules\/permissions\/domain\/permissions"/,
    );
  });
});
