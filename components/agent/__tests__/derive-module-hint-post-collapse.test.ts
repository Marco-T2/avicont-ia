/**
 * T21 [RED → GREEN] — derive-module-hint post-collapse
 * (retire-farm-collapse-to-lot, REQ-200).
 *
 * After T21 the helper maps ONLY `/lots/...` to `"farm"`. The
 * `/farms/...` branch is dropped because the /farms hierarchy is
 * retired in T22 — any surviving path under /farms would 404, so
 * mapping it to a moduleHint is dead behavior.
 *
 * Expected failure mode (RED): current helper still maps
 * /<orgSlug>/farms/... to "farm". 2/2 fail. GREEN after the helper
 * drops the farms branch.
 */
import { describe, expect, it } from "vitest";
import { deriveModuleHint } from "../derive-module-hint";

describe("deriveModuleHint — post-collapse (T21)", () => {
  it("does NOT map /<org>/farms/... to 'farm' anymore (returns null)", () => {
    expect(deriveModuleHint("/acme/farms")).toBeNull();
    expect(deriveModuleHint("/acme/farms/farm-123")).toBeNull();
  });

  it("STILL maps /<org>/lots/... to 'farm' (the surviving farm-module hint)", () => {
    expect(deriveModuleHint("/acme/lots")).toBe("farm");
    expect(deriveModuleHint("/acme/lots/lot-456")).toBe("farm");
  });
});
