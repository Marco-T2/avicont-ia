/**
 * T7.1 — Settings hub cards structure test.
 *
 * REQ-OP.8: the hub must have exactly 8 cards, with the 8th being
 * "Perfil de Empresa" linking to `/${orgSlug}/settings/company`.
 *
 * We assert on the data structure (SETTINGS_CARDS) rather than rendering the
 * RSC page directly — RSC + requirePermission requires a DB for the permission
 * matrix. The page file re-exports this same array, so structural parity is
 * guaranteed.
 */
import { describe, it, expect } from "vitest";
import { SETTINGS_CARDS } from "../settings-cards";

describe("SETTINGS_CARDS", () => {
  it("contiene exactamente 8 tarjetas", () => {
    expect(SETTINGS_CARDS).toHaveLength(8);
  });

  it("la 8va tarjeta es 'Perfil de Empresa'", () => {
    const last = SETTINGS_CARDS[7];
    expect(last.id).toBe("company");
    expect(last.title).toBe("Perfil de Empresa");
  });

  it("la tarjeta company apunta a /${orgSlug}/settings/company", () => {
    const card = SETTINGS_CARDS.find((c) => c.id === "company");
    expect(card).toBeDefined();
    expect(card!.href("demo-org")).toBe("/demo-org/settings/company");
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
});
