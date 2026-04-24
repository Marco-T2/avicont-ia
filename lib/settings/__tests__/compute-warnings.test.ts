/**
 * PR3.1 [RED] — Tests for computeWarnings() pure function
 * REQ-RM.16, REQ-RM.17, REQ-RM.18, REQ-RM.19
 *
 * All tests must fail with "Cannot find module '@/lib/settings/compute-warnings'"
 * until PR3.2 [GREEN] creates the module.
 */
import { describe, it, expect } from "vitest";
import type { Resource, PostableResource } from "@/features/permissions";
import type { Module } from "@/components/sidebar/modules/registry";
import { computeWarnings } from "@/lib/settings/compute-warnings";

// ─── Module stub (mirrors real registry) ────────────────────────────────────

function makeModule(id: string, label: string, resources: Resource[]): Module {
  return {
    id: id as Module["id"],
    label,
    icon: null,
    resources,
    homeRoute: () => "/",
    navItems: [],
  };
}

const MODULES_STUB: Module[] = [
  makeModule("contabilidad", "Contabilidad", [
    "journal",
    "sales",
    "purchases",
    "payments",
    "dispatches",
    "reports",
    "contacts",
    "accounting-config",
  ]),
  makeModule("granjas", "Granjas", ["farms"]),
];

// ─── Helpers for typed Sets ──────────────────────────────────────────────────

function rs(...resources: Resource[]): Set<Resource> {
  return new Set<Resource>(resources);
}

function ws(...resources: Resource[]): Set<Resource> {
  return new Set<Resource>(resources);
}

function ps(...resources: PostableResource[]): Set<PostableResource> {
  return new Set<PostableResource>(resources);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("computeWarnings()", () => {
  // (a) All sets empty → empty-sidebar warning
  it("(a) empty readSet → returns empty-sidebar warning", () => {
    const warnings = computeWarnings(rs(), ws(), ps(), MODULES_STUB);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe("soft");
    // Should mention no module or ningún módulo
    expect(warnings[0].message).toMatch(/ningún módulo/i);
  });

  // (b) readSet = {"members"} (cross-module only, not in any MODULES[]) → empty-sidebar warning
  it("(b) readSet={'members'} (cross-module only) → still triggers empty-sidebar warning", () => {
    const warnings = computeWarnings(rs("members"), ws(), ps(), MODULES_STUB);
    // 'members' is not in any module's resources[] so no module is visible
    const emptySidebar = warnings.find((w) => w.message.match(/ningún módulo/i));
    expect(emptySidebar).toBeDefined();
  });

  // (c) readSet = {"farms"} (module-owned resource) → NO empty-sidebar warning
  it("(c) readSet={'farms'} (module-owned) → NO empty-sidebar warning", () => {
    const warnings = computeWarnings(rs("farms"), ws(), ps(), MODULES_STUB);
    const emptySidebar = warnings.find((w) => w.message.match(/ningún módulo/i));
    expect(emptySidebar).toBeUndefined();
  });

  // (d) writeSet={"journal"}, readSet=∅ → write-without-read warning for Libro Diario
  it("(d) writeSet={'journal'}, readSet=∅ → write-without-read warning for Libro Diario", () => {
    const warnings = computeWarnings(rs(), ws("journal"), ps(), MODULES_STUB);
    const writeWarning = warnings.find(
      (w) => "resource" in w && w.resource === "journal",
    );
    expect(writeWarning).toBeDefined();
    expect(writeWarning!.message).toMatch(/Libro Diario/i);
    // Should mention needing Ver to Editar
    expect(writeWarning!.message).toMatch(/Ver|ver/);
  });

  // (e) postSet={"sales"}, writeSet=∅ → post-without-write warning for Ventas
  it("(e) postSet={'sales'}, writeSet=∅ → post-without-write warning for Ventas", () => {
    const warnings = computeWarnings(rs(), ws(), ps("sales"), MODULES_STUB);
    const postWarning = warnings.find(
      (w) => "resource" in w && w.resource === "sales",
    );
    expect(postWarning).toBeDefined();
    expect(postWarning!.message).toMatch(/Ventas/i);
    // Should mention needing Editar to Registrar
    expect(postWarning!.message).toMatch(/Editar|editar/);
  });

  // (f) All correct → returns []
  it("(f) happy path (no warnings): canonical admin-like state → returns []", () => {
    // All resources readable + writable + all postables posted
    const allResources: Resource[] = [
      "members",
      "accounting-config",
      "sales",
      "purchases",
      "payments",
      "journal",
      "dispatches",
      "reports",
      "contacts",
      "farms",
      "documents",
      "agent",
    ];
    const allPostable: PostableResource[] = ["sales", "purchases", "journal"];
    const readSet = new Set<Resource>(allResources);
    const writeSet = new Set<Resource>(allResources);
    const postSet = new Set<PostableResource>(allPostable);
    const warnings = computeWarnings(readSet, writeSet, postSet, MODULES_STUB);
    expect(warnings).toHaveLength(0);
  });

  // Bonus: combined — all three warning types at once
  it("(combined) all three warning types returned together", () => {
    // readSet empty → empty-sidebar
    // writeSet has "journal" (not in readSet) → write-without-read
    // postSet has "sales" (not in writeSet) → post-without-write
    const warnings = computeWarnings(rs(), ws("journal"), ps("sales"), MODULES_STUB);

    const emptySidebarW = warnings.find((w) => w.message.match(/ningún módulo/i));
    const writeW = warnings.find((w) => "resource" in w && w.resource === "journal");
    const postW = warnings.find((w) => "resource" in w && w.resource === "sales");

    expect(emptySidebarW).toBeDefined();
    expect(writeW).toBeDefined();
    expect(postW).toBeDefined();
  });
});
