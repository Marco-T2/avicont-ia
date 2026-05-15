/**
 * PR1.1 [RED] — REQ-MS.1: Module registry shape + completeness tests.
 *
 * Verifies that MODULES contains the required entries with the correct
 * structure: id, label, icon, resources[], homeRoute, navItems[].
 * Pure imports — no React rendering needed (node environment).
 */
import { describe, it, expect } from "vitest";
import { MODULES } from "../registry";

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
  it("has an entry with id 'contabilidad'", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad");
    expect(entry).toBeDefined();
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

  // C1 [GREEN] — sidebar-reorg-settings-hub: Contabilidad trimmed to 8 flat
  // leaves, zero separators. Previously 12 leaves + 2 separators ("Operaciones",
  // "Contabilidad"). PdC / CxC / CxP / Cierre Mensual moved to Settings / Informes.
  it("has EXACTLY 8 flat leaf navItems (sidebar-reorg-settings-hub trim)", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad")!;
    expect(entry.navItems).toHaveLength(8);
  });

  it("has ZERO separator navItems (sidebar-reorg-settings-hub trim)", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad")!;
    const seps = entry.navItems.filter((item) => item.isSeparator);
    expect(seps).toHaveLength(0);
  });

  it("does NOT contain Cuentas por Cobrar / Cuentas por Pagar / Plan de Cuentas / Cierre Mensual leaves", () => {
    const entry = MODULES.find((m) => m.id === "contabilidad")!;
    const removedLabels = [
      "Cuentas por Cobrar",
      "Cuentas por Pagar",
      "Plan de Cuentas",
      "Cierre Mensual",
    ];
    for (const removed of removedLabels) {
      const hit = entry.navItems.find(
        (item) => !item.isSeparator && item.label === removed,
      );
      expect(hit).toBeUndefined();
    }
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
// PR2.1 [RED] — REQ-RNM.1: "Ventas" nav item must gate on "sales"
// (not "dispatches"). dispatches remains in the Resource union and in the
// Contabilidad module's resources[] array, but NO nav item points to it.
// ---------------------------------------------------------------------------

describe("REQ-RNM.1 — Ventas nav-resource mapping", () => {
  it("Ventas nav item has resource: 'sales'", () => {
    const contabilidad = MODULES.find((m) => m.id === "contabilidad")!;
    const ventas = contabilidad.navItems.find(
      (item) => !item.isSeparator && item.label === "Ventas",
    );
    expect(ventas).toBeDefined();
    expect(ventas!.resource).toBe("sales");
  });
});

// ---------------------------------------------------------------------------
// REQ-5 — "Cierre Mensual" removed from Contabilidad navItems.
// (sidebar-reorg-settings-hub C1: Cierre Mensual relocated to Settings hub
// as a card. The previous REQ-5 test asserted resource='period' on the
// in-sidebar entry; the entry no longer exists.)
// ---------------------------------------------------------------------------

describe("sidebar-reorg-settings-hub — Cierre Mensual no longer in Contabilidad sidebar", () => {
  it("Contabilidad has NO 'Cierre Mensual' nav item (moved to Settings hub)", () => {
    const contabilidad = MODULES.find((m) => m.id === "contabilidad")!;
    const cierreMensual = contabilidad.navItems.find(
      (item) => !item.isSeparator && item.label === "Cierre Mensual",
    );
    expect(cierreMensual).toBeUndefined();
  });
});
