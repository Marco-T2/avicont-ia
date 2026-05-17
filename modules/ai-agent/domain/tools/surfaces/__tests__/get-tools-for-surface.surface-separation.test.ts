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

describe("SCN-3.1: sidebar-qa × member", () => {
  it("returns only searchDocuments", () => {
    const tools = getToolsForSurface({ surface: "sidebar-qa", role: "member" });
    expect(tools.map((t) => t.name)).toEqual(["searchDocuments"]);
  });
});

describe("SCN-3.2: modal-registrar × member", () => {
  it("returns all 6 chat tools", () => {
    const tools = getToolsForSurface({
      surface: "modal-registrar",
      role: "member",
    });
    expect(tools).toHaveLength(6);
  });
});

describe("SCN-3.3: sidebar-qa × cobrador (RBAC delta — gains searchDocuments)", () => {
  it("returns [searchDocuments] — cobrador has documents:read in matrix", () => {
    const tools = getToolsForSurface({
      surface: "sidebar-qa",
      role: "cobrador",
    });
    expect(tools.map((t) => t.name)).toEqual(["searchDocuments"]);
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

describe("SCN-3.5: modal-registrar × contador (RBAC delta — gains ALL 6)", () => {
  it("returns all 6 tools — PERMISSIONS_WRITE.farms includes contador", () => {
    const tools = getToolsForSurface({
      surface: "modal-registrar",
      role: "contador",
    });
    expect(tools).toHaveLength(6);
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
