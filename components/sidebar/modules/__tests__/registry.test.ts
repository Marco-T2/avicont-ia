/**
 * PR1.1 [RED] — REQ-MS.1: Module registry shape + completeness tests.
 *
 * Verifies that MODULES contains the required entries with the correct
 * structure: id, label, icon, resources[], homeRoute, navItems[].
 * Pure imports — no React rendering needed (node environment).
 */
import { describe, it, expect } from "vitest";
import {
  MODULES,
  type Module,
  type ModuleId,
  type ModuleNavItem,
} from "../registry";

describe("REQ-MS.1 — Module registry shape", () => {
  it("exports MODULES as a non-empty array", () => {
    expect(Array.isArray(MODULES)).toBe(true);
    expect(MODULES.length).toBeGreaterThan(0);
  });

  it("every module has all required fields", () => {
    for (const mod of MODULES) {
      expect(mod).toHaveProperty("id");
      expect(mod).toHaveProperty("label");
      expect(mod).toHaveProperty("icon");
      expect(Array.isArray(mod.resources)).toBe(true);
      expect(mod.resources.length).toBeGreaterThan(0);
      expect(typeof mod.homeRoute).toBe("function");
      expect(Array.isArray(mod.navItems)).toBe(true);
    }
  });

  it("homeRoute returns a string when called with an orgSlug", () => {
    for (const mod of MODULES) {
      const route = mod.homeRoute("test-org");
      expect(typeof route).toBe("string");
      expect(route.startsWith("/test-org")).toBe(true);
    }
  });
});

describe("REQ-MS.1 — Contabilidad entry", () => {
  let contabilidad: Module;

  it("has an entry with id 'contabilidad'", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad");
    expect(entry).toBeDefined();
    contabilidad = entry!;
  });

  it("has exactly 8 resources", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad")!;
    expect(entry.resources).toHaveLength(8);
  });

  it("contains all expected accounting resources", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad")!;
    const expected = [
      "journal",
      "sales",
      "purchases",
      "payments",
      "dispatches",
      "reports",
      "contacts",
      "accounting-config",
    ];
    for (const r of expected) {
      expect(entry.resources).toContain(r);
    }
  });

  it("has at least 12 navItems (including separators; PR4.9 removed Configuración)", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad")!;
    expect(entry.navItems.length).toBeGreaterThanOrEqual(12);
  });

  it("homeRoute returns /{orgSlug}/accounting", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad")!;
    expect(entry.homeRoute("my-org")).toBe("/my-org/accounting");
  });
});

describe("REQ-MS.1 — Granjas entry", () => {
  it("has an entry with id 'granjas'", () => {
    const entry = MODULES.find((m) => m.id === "granjas");
    expect(entry).toBeDefined();
  });

  it("has resources: ['farms']", () => {
    const entry = MODULES.find((m) => m.id === "granjas")!;
    expect(entry.resources).toEqual(["farms"]);
  });

  it("has at least one navItem for Mis Granjas", () => {
    const entry = MODULES.find((m) => m.id === "granjas")!;
    const miGranjas = entry.navItems.find(
      (item) => !item.isSeparator && item.label === "Mis Granjas"
    );
    expect(miGranjas).toBeDefined();
  });

  it("homeRoute returns /{orgSlug}/farms", () => {
    const entry = MODULES.find((m) => m.id === "granjas")!;
    expect(entry.homeRoute("my-org")).toBe("/my-org/farms");
  });
});

describe("REQ-MS.1 — ModuleId type completeness", () => {
  it("MODULES covers both known ModuleId values", () => {
    const ids = MODULES.map((m) => m.id);
    expect(ids).toContain("contabilidad");
    expect(ids).toContain("granjas");
  });
});

// ---------------------------------------------------------------------------
// PR4.9 [RED] — Cleanup tweak: Configuración is org-level and lives only in
// <SidebarFooter>. The Contabilidad module's navItems MUST NOT contain a
// "Configuración" entry (avoids the duplicated link users saw when
// Contabilidad was active).
// ---------------------------------------------------------------------------

describe("PR4.9 — Configuración duplicate removed from Contabilidad navItems", () => {
  it("Contabilidad module has NO navItem labelled 'Configuración' (org-level link lives in SidebarFooter)", () => {
    const contabilidad = MODULES.find((m) => m.id === "contabilidad")!;
    const configItem = contabilidad.navItems.find(
      (item) => !item.isSeparator && item.label === "Configuración",
    );
    expect(configItem).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PR2.1 [RED] — REQ-RNM.1: "Ventas y Despachos" nav item must gate on "sales"
// (not "dispatches"). dispatches remains in the Resource union and in the
// Contabilidad module's resources[] array, but NO nav item points to it.
// ---------------------------------------------------------------------------

describe("REQ-RNM.1 — Ventas y Despachos nav-resource mapping", () => {
  it("Ventas y Despachos nav item has resource: 'sales'", () => {
    const contabilidad = MODULES.find((m) => m.id === "contabilidad")!;
    const ventasDespachos = contabilidad.navItems.find(
      (item) => !item.isSeparator && item.label === "Ventas y Despachos",
    );
    expect(ventasDespachos).toBeDefined();
    expect(ventasDespachos!.resource).toBe("sales");
  });
});

// ---------------------------------------------------------------------------
// REQ-5 [RED] — "Cierre Mensual" nav entry resource must be "period"
// (REQ-5: sidebar visibility via PERMISSIONS_READ["period"], not "journal").
// RED: registry.ts:113 still has resource: "journal" — asserts "period".
// ---------------------------------------------------------------------------

describe("REQ-5 — Cierre Mensual nav entry resource gating", () => {
  it("\"Cierre Mensual\" nav item has resource: 'period'", () => {
    const contabilidad = MODULES.find((m) => m.id === "contabilidad")!;
    const cierreMensual = contabilidad.navItems.find(
      (item) => !item.isSeparator && item.label === "Cierre Mensual",
    );
    expect(cierreMensual).toBeDefined();
    expect(cierreMensual!.resource).toBe("period");
  });
});
