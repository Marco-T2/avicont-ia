import { describe, expect, it } from "vitest";
import { MODAL_REGISTRAR_SURFACE } from "../modal-registrar.surface";

// SCN-1.2 — modal-registrar carries 5 chat tools (write + supporting reads).
// Post retire-farm-collapse-to-lot (T23): `listFarms` retirado — Farm
// desaparece como concepto, `farmName` libre en Lot (REQ-200).

describe("SCN-1.2: modal-registrar surface bundle", () => {
  it("bundle name is 'modal-registrar'", () => {
    expect(MODAL_REGISTRAR_SURFACE.name).toBe("modal-registrar");
  });

  it("has exactly 5 tools (post-collapse)", () => {
    expect(MODAL_REGISTRAR_SURFACE.tools).toHaveLength(5);
  });

  it("includes createExpense and logMortality (write)", () => {
    const names = MODAL_REGISTRAR_SURFACE.tools.map((t) => t.name);
    expect(names).toContain("createExpense");
    expect(names).toContain("logMortality");
  });

  it("includes the 3 read tools (getLotSummary, listLots, searchDocuments)", () => {
    const names = MODAL_REGISTRAR_SURFACE.tools.map((t) => t.name);
    expect(names).toContain("getLotSummary");
    expect(names).toContain("listLots");
    expect(names).toContain("searchDocuments");
  });

  it("excludes listFarms (retired in retire-farm-collapse-to-lot T23)", () => {
    expect(MODAL_REGISTRAR_SURFACE.tools.map((t) => t.name)).not.toContain(
      "listFarms",
    );
  });
});
