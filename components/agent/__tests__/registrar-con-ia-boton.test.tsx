/**
 * Behavioral mount/click tests — Botón Registrar con IA trigger modal mount POC #2 C2.
 *
 * Paired sister precedent STRUCTURAL EXACT mirror:
 *   - components/agent/registrar-con-ia/__tests__/registrar-con-ia.test.tsx (C0 mount/render
 *     jsdom + afterEach cleanup canonical iva-books paired sister + vi.mock convention).
 *
 * Verifica behavioral botón component reusable single source of truth 2 contextos
 * (Q1 lock Opt A APROBADO reusable vs inline copy-paste anti-pattern):
 *   - Botón renders Button with text "Registrar con IA" + 🤖 emoji
 *   - Initial state modal NOT mounted (open=false default useState state)
 *   - Click button → setState open=true → Modal mounted (stub present)
 *   - Click button → Modal receives orgSlug prop pass-through correctly
 *   - ContextHints lot variant {lotId, lotName, farmId} → Modal receives pass-through verified
 *   - ContextHints farm variant {farmId, farmName} → Modal receives pass-through verified
 *
 * Modal mocked as inline stub via vi.mock("@/components/agent/registrar-con-ia") — botón SUT
 * scope acotado trigger + state mgmt + props pass-through. Modal cementado C0+C1 separately
 * tested. Stub serializes contextHints + orgSlug en data attributes para inspection.
 *
 * RED-α C2: collect-time FAIL Cannot find module '../registrar-con-ia-boton' (component
 * greenfield NO existe yet) → vitest collect import error → entire test file fails to
 * collect pre-GREEN. Combined mode con shape file α26-α29 behavioral assertion mismatch
 * paired sister C0+C1 precedent EXACT mirror cumulative cross-POC matures.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

afterEach(() => cleanup());

vi.mock("@/components/agent/registrar-con-ia", () => ({
  default: (props: {
    orgSlug: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contextHints: Record<string, string | undefined>;
  }) =>
    props.open ? (
      <div
        data-testid="modal-stub"
        data-org-slug={props.orgSlug}
        data-context-hints={JSON.stringify(props.contextHints)}
      />
    ) : null,
}));

import RegistrarConIABoton from "../registrar-con-ia-boton";

describe("RegistrarConIABoton — C2 trigger modal mount behavioral", () => {
  // α30
  it("renders Button with text 'Registrar con IA' + 🤖 emoji", () => {
    render(
      <RegistrarConIABoton
        orgSlug="acme"
        contextHints={{ lotId: "lot-1", lotName: "Lote 1", farmId: "farm-1" }}
      />,
    );
    expect(
      screen.getByRole("button", { name: /🤖\s*Registrar con IA/i }),
    ).toBeTruthy();
  });

  // α31
  it("initial state modal NOT mounted (open=false default state, stub absent)", () => {
    render(
      <RegistrarConIABoton
        orgSlug="acme"
        contextHints={{ lotId: "lot-1", lotName: "Lote 1", farmId: "farm-1" }}
      />,
    );
    expect(screen.queryByTestId("modal-stub")).toBeNull();
  });

  // α32
  it("click button → setState open=true → Modal mounted (stub present)", () => {
    render(
      <RegistrarConIABoton
        orgSlug="acme"
        contextHints={{ lotId: "lot-1", lotName: "Lote 1", farmId: "farm-1" }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /🤖\s*Registrar con IA/i }),
    );
    expect(screen.getByTestId("modal-stub")).toBeTruthy();
  });

  // α33
  it("click button → Modal receives orgSlug prop pass-through correctly", () => {
    render(
      <RegistrarConIABoton
        orgSlug="acme"
        contextHints={{ lotId: "lot-1", lotName: "Lote 1", farmId: "farm-1" }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /🤖\s*Registrar con IA/i }),
    );
    expect(screen.getByTestId("modal-stub").getAttribute("data-org-slug")).toBe(
      "acme",
    );
  });

  // α34
  it("contextHints lot variant {lotId, lotName, farmId} passed through to Modal verified", () => {
    render(
      <RegistrarConIABoton
        orgSlug="acme"
        contextHints={{
          lotId: "lot-xyz",
          lotName: "Lote XYZ - Galpón 5",
          farmId: "farm-abc",
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /🤖\s*Registrar con IA/i }),
    );
    const stub = screen.getByTestId("modal-stub");
    const hints = JSON.parse(stub.getAttribute("data-context-hints") ?? "{}");
    expect(hints).toEqual(
      expect.objectContaining({
        lotId: "lot-xyz",
        lotName: "Lote XYZ - Galpón 5",
        farmId: "farm-abc",
      }),
    );
  });

  // α35
  it("contextHints farm variant {farmId, farmName} passed through to Modal verified", () => {
    render(
      <RegistrarConIABoton
        orgSlug="acme"
        contextHints={{ farmId: "farm-xyz", farmName: "Granja XYZ" }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /🤖\s*Registrar con IA/i }),
    );
    const stub = screen.getByTestId("modal-stub");
    const hints = JSON.parse(stub.getAttribute("data-context-hints") ?? "{}");
    expect(hints).toEqual(
      expect.objectContaining({
        farmId: "farm-xyz",
        farmName: "Granja XYZ",
      }),
    );
  });
});
