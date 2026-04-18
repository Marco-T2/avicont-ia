/**
 * T6.3 — AddMemberDialog role picker
 *
 * REQ-rbac-roles: el picker de AddMemberDialog debe ofrecer los roles
 * asignables (sin owner) y NO debe permitir elegir "owner"
 * (el owner es implícito al crear la organización, no asignable por admin).
 *
 * PR7.2: el picker ahora es dinámico — fetcha /api/organizations/[orgSlug]/roles.
 * El test mockea fetch con los 6 roles del sistema (owner incluido en la API,
 * pero el picker lo filtra). Los nombres del API coinciden con las etiquetas
 * previas para mantener la cobertura de requerimiento.
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
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
  // Mock fetch con los roles del sistema (owner incluido — el picker lo filtra)
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      roles: [
        { slug: "owner", name: "Propietario", isSystem: true },
        { slug: "admin", name: "Administrador", isSystem: true },
        { slug: "contador", name: "Contador", isSystem: true },
        { slug: "cobrador", name: "Cobrador", isSystem: true },
        { slug: "auxiliar", name: "Auxiliar", isSystem: true },
        { slug: "member", name: "Socio", isSystem: true },
      ],
    }),
  }) as unknown as typeof fetch;
});

// Sonner mock
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

async function openDialogAndSelect() {
  // Abrir el dialog
  fireEvent.click(screen.getByRole("button", { name: /agregar miembro/i }));
  // Esperar a que los roles carguen
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
  // Abrir el Select del rol
  const trigger = screen.getByRole("combobox");
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
}

describe("AddMemberDialog — role picker options (rbac-roles REQ)", () => {
  it("T6.3-1 — el Select muestra exactamente los 5 roles asignables: admin, contador, cobrador, auxiliar, member", async () => {
    render(<AddMemberDialog orgSlug="test-org" />);
    await openDialogAndSelect();

    // Deben aparecer los 5 roles asignables (por etiqueta)
    expect(await screen.findByRole("option", { name: /administrador/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /contador/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /cobrador/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /auxiliar/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /socio/i })).toBeInTheDocument();
  });

  it("T6.3-2 — el Select NO ofrece 'Propietario' (owner es implícito, no asignable)", async () => {
    render(<AddMemberDialog orgSlug="test-org" />);
    await openDialogAndSelect();

    // Esperar a que el listbox esté montado
    await screen.findByRole("option", { name: /administrador/i });
    expect(screen.queryByRole("option", { name: /propietario/i })).not.toBeInTheDocument();
  });
});
