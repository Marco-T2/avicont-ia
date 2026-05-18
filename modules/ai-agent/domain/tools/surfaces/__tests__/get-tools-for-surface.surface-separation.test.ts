import { describe, expect, it } from "vitest";
import { getToolsForSurface } from "../index.ts";

// REQ-3 — getToolsForSurface cross-filters a surface bundle against the
// permissions matrix (PERMISSIONS_READ / PERMISSIONS_WRITE).
//
// RBAC delta lock (#2740 — Marco accepted both):
//   - contador × modal-registrar → ALL 6 tools (matrix-canonical;
//     PERMISSIONS_WRITE.farms includes contador).
//   - cobrador × sidebar-qa AND modal-registrar → [searchDocuments]
//     (matrix-canonical; PERMISSIONS_READ.documents includes cobrador).

describe("SCN-3.1: sidebar-qa × member (post-collapse — searchDocuments + granja reads)", () => {
  it("returns [searchDocuments, getLotSummary, listLots]", () => {
    // member tiene documents:read + farms:read → ve las 3 tools del bundle.
    const tools = getToolsForSurface({ surface: "sidebar-qa", role: "member" });
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["searchDocuments", "getLotSummary", "listLots"].sort(),
    );
  });
});

describe("SCN-3.2: modal-registrar × member", () => {
  it("returns all 5 chat tools (post-collapse)", () => {
    const tools = getToolsForSurface({
      surface: "modal-registrar",
      role: "member",
    });
    expect(tools).toHaveLength(5);
  });
});

describe("SCN-3.3: sidebar-qa × cobrador (post-collapse — solo searchDocuments)", () => {
  it("returns [searchDocuments] — cobrador no tiene farms:read", () => {
    // Post retire-farm-collapse-to-lot T23: el bundle quedó en
    // [searchDocuments, getLotSummary, listLots]; cobrador solo gana
    // documents:read (NO farms:read), por lo tanto el resultado es
    // [searchDocuments].
    const tools = getToolsForSurface({
      surface: "sidebar-qa",
      role: "cobrador",
    });
    expect(tools.map((t) => t.name)).toEqual(["searchDocuments"]);
    // Negatives explícitos — granja read deniegado para cobrador.
    expect(tools.map((t) => t.name)).not.toContain("listFarms");
    expect(tools.map((t) => t.name)).not.toContain("listLots");
    expect(tools.map((t) => t.name)).not.toContain("getLotSummary");
  });
});

describe("SCN-3.4: modal-registrar × cobrador (RBAC delta — gains searchDocuments)", () => {
  it("returns [searchDocuments] for cobrador", () => {
    const tools = getToolsForSurface({
      surface: "modal-registrar",
      role: "cobrador",
    });
    expect(tools.map((t) => t.name)).toEqual(["searchDocuments"]);
  });
});

describe("SCN-3.5: modal-registrar × contador (RBAC delta — gains ALL 5)", () => {
  it("returns all 5 tools — PERMISSIONS_WRITE.farms includes contador", () => {
    const tools = getToolsForSurface({
      surface: "modal-registrar",
      role: "contador",
    });
    expect(tools).toHaveLength(5);
  });
});

describe("SCN-3.6: modal-journal-ai × contador", () => {
  it("returns [parseAccountingOperationToSuggestion]", () => {
    const tools = getToolsForSurface({
      surface: "modal-journal-ai",
      role: "contador",
    });
    expect(tools.map((t) => t.name)).toEqual([
      "parseAccountingOperationToSuggestion",
    ]);
  });
});

describe("SCN-3.7: modal-journal-ai × cobrador returns empty (no journal:write)", () => {
  it("returns []", () => {
    const tools = getToolsForSurface({
      surface: "modal-journal-ai",
      role: "cobrador",
    });
    expect(tools).toHaveLength(0);
  });
});
