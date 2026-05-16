/**
 * Settings hub cards structure test.
 *
 * Pre-C3 (REQ-OP.8): 8 cards, the 8th being "Perfil de Empresa".
 * C3 sidebar-reorg-settings-hub absorbed Plan de Cuentas + Cierre Mensual +
 * Auditoría (11 cards). Cierre Mensual was later REMOVED — the unfiltered
 * entry let users land on /accounting/monthly-close without a periodId
 * context and manually close December, breaking the annual-close
 * orchestrator's atomicity (which expects Dec to be locked inside the same
 * tx as CC + auto-periods + CA). The only legitimate entry to monthly-close
 * is now `/{orgSlug}/settings/periods` → per-row "Cerrar" link with
 * `?periodId=...` (annual-period-list.tsx:301). Total cards = 10.
 *
 * We assert on the data structure (SETTINGS_CARDS) rather than rendering the
 * RSC page directly — RSC + requirePermission requires a DB for the permission
 * matrix.
 */
import { describe, it, expect } from "vitest";
import { SETTINGS_CARDS } from "../settings-cards";

describe("SETTINGS_CARDS", () => {
  it("contiene exactamente 10 tarjetas (8 originales + Plan de Cuentas + Auditoría; Cierre Mensual removed)", () => {
    expect(SETTINGS_CARDS).toHaveLength(10);
  });

  it("la tarjeta 'Perfil de Empresa' está presente con href correcto", () => {
    const company = SETTINGS_CARDS.find((c) => c.id === "company");
    expect(company).toBeDefined();
    expect(company!.title).toBe("Perfil de Empresa");
    expect(company!.href("demo-org")).toBe("/demo-org/settings/company");
  });

  it("todas las tarjetas tienen id, title, description, href y Icon", () => {
    for (const card of SETTINGS_CARDS) {
      expect(card.id).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(typeof card.href).toBe("function");
      expect(card.Icon).toBeTruthy();
    }
  });

  it("no hay ids duplicados", () => {
    const ids = SETTINGS_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // C3 sidebar-reorg-settings-hub: 3 new cards
  it("incluye la tarjeta 'Plan de Cuentas' con resource accounting-config", () => {
    const card = SETTINGS_CARDS.find((c) => c.id === "plan-cuentas");
    expect(card).toBeDefined();
    expect(card!.title).toBe("Plan de Cuentas");
    expect(card!.href("demo-org")).toBe("/demo-org/accounting/accounts");
    expect(card!.resource).toBe("accounting-config");
  });

  it("NO incluye la tarjeta 'Cierre Mensual' (entrada sin periodId rompe atomicity del annual-close)", () => {
    const card = SETTINGS_CARDS.find((c) => c.id === "monthly-close");
    expect(card).toBeUndefined();
  });

  it("incluye la tarjeta 'Auditoría' con resource audit", () => {
    const card = SETTINGS_CARDS.find((c) => c.id === "audit");
    expect(card).toBeDefined();
    expect(card!.title).toBe("Auditoría");
    expect(card!.href("demo-org")).toBe("/demo-org/audit");
    expect(card!.resource).toBe("audit");
  });

  it("la tarjeta 'Miembros' usa resource members", () => {
    const card = SETTINGS_CARDS.find((c) => c.id === "members");
    expect(card).toBeDefined();
    expect(card!.resource).toBe("members");
  });

  it("la tarjeta 'Roles y Permisos' usa resource members (gating convencional)", () => {
    const card = SETTINGS_CARDS.find((c) => c.id === "roles");
    expect(card).toBeDefined();
    expect(card!.resource).toBe("members");
  });
});
