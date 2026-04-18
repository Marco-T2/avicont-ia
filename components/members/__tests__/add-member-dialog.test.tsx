/**
 * T6.3 RED — accounting-rbac PR6
 *
 * REQ-rbac-roles: el picker de AddMemberDialog debe ofrecer los 5 roles asignables
 * (admin, contador, cobrador, auxiliar, member) y NO debe permitir elegir "owner"
 * (el owner es implícito al crear la organización, no asignable por admin).
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddMemberDialog from "../add-member-dialog";

afterEach(() => cleanup());

// Radix Select usa pointerCapture/scrollIntoView en jsdom — shimear
beforeEach(() => {
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

// Sonner mock
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function openDialogAndSelect() {
  // Abrir el dialog
  fireEvent.click(screen.getByRole("button", { name: /agregar miembro/i }));
  // Abrir el Select del rol
  const trigger = screen.getByRole("combobox");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe("AddMemberDialog — role picker options (rbac-roles REQ)", () => {
  it("T6.3-1 — el Select muestra exactamente los 5 roles asignables: admin, contador, cobrador, auxiliar, member", async () => {
    render(<AddMemberDialog orgSlug="test-org" />);
    openDialogAndSelect();

    // Deben aparecer los 5 roles asignables (por etiqueta)
    expect(await screen.findByRole("option", { name: /administrador/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /contador/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /cobrador/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /auxiliar/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /socio/i })).toBeInTheDocument();
  });

  it("T6.3-2 — el Select NO ofrece 'Propietario' (owner es implícito, no asignable)", async () => {
    render(<AddMemberDialog orgSlug="test-org" />);
    openDialogAndSelect();

    // Esperar a que el listbox esté montado
    await screen.findByRole("option", { name: /administrador/i });
    expect(screen.queryByRole("option", { name: /propietario/i })).not.toBeInTheDocument();
  });
});
