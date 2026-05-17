import { describe, expect, it } from "vitest";
import { SURFACE_REGISTRY, SURFACES } from "../index";

// SCN-1.4 — registry covers all 3 surfaces with matching keys.

describe("SCN-1.4: SURFACE_REGISTRY", () => {
  it("SURFACES is a 3-tuple", () => {
    expect(SURFACES).toHaveLength(3);
    expect([...SURFACES].sort()).toEqual(
      ["modal-journal-ai", "modal-registrar", "sidebar-qa"],
    );
  });

  it("SURFACE_REGISTRY keys match SURFACES", () => {
    expect(Object.keys(SURFACE_REGISTRY).sort()).toEqual([...SURFACES].sort());
  });

  it("each registry value has a name matching its key", () => {
    for (const surface of SURFACES) {
      expect(SURFACE_REGISTRY[surface]?.name).toBe(surface);
    }
  });
});
