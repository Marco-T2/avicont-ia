import { describe, expect, it } from "vitest";
import { getToolsForSurface } from "../index";

// RBAC smoke per role para el sidebar-qa bundle post-cleanup #2026-05-17.
// Bundle = [searchDocuments, getLotSummary, listFarms, listLots]. Names
// (no solo counts) per design §8: catches silent additions.
//
// PERMISSIONS_READ.documents = [owner, admin, contador, cobrador, member]
// PERMISSIONS_READ.farms     = [owner, admin, contador, member]
//
// Por lo tanto:
//   - owner/admin/contador/member → 4 tools (todas).
//   - cobrador → 1 tool (solo searchDocuments; sin farms:read).

const ALL_4_SIDEBAR_QA = [
  "searchDocuments",
  "getLotSummary",
  "listFarms",
  "listLots",
] as const;

describe("RBAC sidebar-qa × owner — full 4-tool set", () => {
  it("returns todas las 4 tools del bundle", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "owner",
    }).map((t) => t.name);
    expect(names.sort()).toEqual([...ALL_4_SIDEBAR_QA].sort());
  });
});

describe("RBAC sidebar-qa × admin — full 4-tool set", () => {
  it("returns todas las 4 tools del bundle", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "admin",
    }).map((t) => t.name);
    expect(names.sort()).toEqual([...ALL_4_SIDEBAR_QA].sort());
  });
});

describe("RBAC sidebar-qa × contador — full 4-tool set", () => {
  it("returns todas las 4 tools del bundle (contador tiene documents:read + farms:read)", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "contador",
    }).map((t) => t.name);
    expect(names.sort()).toEqual([...ALL_4_SIDEBAR_QA].sort());
  });
});

describe("RBAC sidebar-qa × member — full 4-tool set", () => {
  it("returns todas las 4 tools del bundle (member tiene documents:read + farms:read)", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "member",
    }).map((t) => t.name);
    expect(names.sort()).toEqual([...ALL_4_SIDEBAR_QA].sort());
  });
});

describe("RBAC sidebar-qa × cobrador — solo searchDocuments", () => {
  it("returns [searchDocuments] — cobrador no tiene farms:read", () => {
    const names = getToolsForSurface({
      surface: "sidebar-qa",
      role: "cobrador",
    }).map((t) => t.name);
    expect(names).toEqual(["searchDocuments"]);
    // Negatives explícitos — granja read deniegado para cobrador.
    expect(names).not.toContain("listFarms");
    expect(names).not.toContain("listLots");
    expect(names).not.toContain("getLotSummary");
  });
});
