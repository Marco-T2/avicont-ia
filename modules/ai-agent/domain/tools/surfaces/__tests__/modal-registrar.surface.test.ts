import { describe, expect, it } from "vitest";
import { MODAL_REGISTRAR_SURFACE } from "../modal-registrar.surface";

// SCN-1.2 — modal-registrar carries all 6 chat tools (write + supporting reads).

describe("SCN-1.2: modal-registrar surface bundle", () => {
  it("bundle name is 'modal-registrar'", () => {
    expect(MODAL_REGISTRAR_SURFACE.name).toBe("modal-registrar");
  });

  it("has exactly 6 tools", () => {
    expect(MODAL_REGISTRAR_SURFACE.tools).toHaveLength(6);
  });

  it("includes createExpense and logMortality (write)", () => {
    const names = MODAL_REGISTRAR_SURFACE.tools.map((t) => t.name);
    expect(names).toContain("createExpense");
    expect(names).toContain("logMortality");
  });

  it("includes the 4 read tools (getLotSummary, listFarms, listLots, searchDocuments)", () => {
    const names = MODAL_REGISTRAR_SURFACE.tools.map((t) => t.name);
    expect(names).toContain("getLotSummary");
    expect(names).toContain("listFarms");
    expect(names).toContain("listLots");
    expect(names).toContain("searchDocuments");
  });
});
