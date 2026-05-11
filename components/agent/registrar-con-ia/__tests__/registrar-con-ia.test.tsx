/**
 * Behavioral mount/render tests — Registrar con IA modal C0 greenfield jsdom.
 *
 * Paired sister precedent STRUCTURAL EXACT mirror: components/accounting/journal-entry-ai-modal/__tests__/.
 * UX SHAPE axis-distinct chat-like simple conversational (granjos UX mobile-friendly mayor):
 *   - Dialog open=true renders modal
 *   - Bot greeting bubble inicial ("Hola, ¿qué querés registrar?")
 *   - 3 action chips ("💰 Gasto" + "💀 Mortalidad" + "✏️ Otro")
 *   - Textarea input + send button
 *   - close handler invoke onOpenChange(false)
 *
 * RED-α C0: collect-time FAIL Cannot find module — import RegistrarConIAModal default
 * desde index.tsx (NO existe greenfield) → vitest collect tira import error → entire
 * test file fails to collect pre-GREEN. Combined mode con shape file α1-α5 DEFERRED
 * paired sister precedent STRUCTURAL EXACT mirror cumulative cross-POC matures.
 */

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/features/ai-agent/client", () => ({
  useAgentQuery: vi.fn(() => ({
    query: vi.fn(),
    confirm: vi.fn(),
    reportEvent: vi.fn(),
    isLoading: false,
    error: null,
  })),
}));

import RegistrarConIAModal from "../index";

describe("RegistrarConIAModal — C0 mount/render IDLE chat-like", () => {
  // α6
  it("renders Dialog when open=true", () => {
    render(
      <RegistrarConIAModal
        orgSlug="acme"
        open={true}
        onOpenChange={() => {}}
        contextHints={{ lotId: "clxx00000000000000000001" }}
      />,
    );
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  // α7
  it("renders bot greeting bubble inicial ('Hola, ¿qué querés registrar?')", () => {
    render(
      <RegistrarConIAModal
        orgSlug="acme"
        open={true}
        onOpenChange={() => {}}
        contextHints={{ lotId: "clxx00000000000000000001" }}
      />,
    );
    expect(screen.getByText(/Hola, ¿qué querés registrar\?/i)).toBeTruthy();
  });

  // α8
  it("renders 3 action chips ('💰 Gasto' + '💀 Mortalidad' + '✏️ Otro')", () => {
    render(
      <RegistrarConIAModal
        orgSlug="acme"
        open={true}
        onOpenChange={() => {}}
        contextHints={{ lotId: "clxx00000000000000000001" }}
      />,
    );
    expect(screen.getByRole("button", { name: /💰\s*Gasto/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /💀\s*Mortalidad/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /✏️\s*Otro/i })).toBeTruthy();
  });

  // α9
  it("renders Textarea input + send button", () => {
    render(
      <RegistrarConIAModal
        orgSlug="acme"
        open={true}
        onOpenChange={() => {}}
        contextHints={{ lotId: "clxx00000000000000000001" }}
      />,
    );
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: /enviar/i })).toBeTruthy();
  });

  // α10
  it("renders nothing when open=false", () => {
    render(
      <RegistrarConIAModal
        orgSlug="acme"
        open={false}
        onOpenChange={() => {}}
        contextHints={{ lotId: "clxx00000000000000000001" }}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
