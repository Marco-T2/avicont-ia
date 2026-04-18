/**
 * PR7.5 RED — <RoleDeleteDialog>
 *
 * REQ: CR.7-S1, U.5-S4
 * (a) DELETE not called until confirmation clicked
 * (b) 409 ROLE_HAS_MEMBERS shown as error
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoleDeleteDialog from "../role-delete-dialog";

afterEach(() => cleanup());

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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function setup(fetchOk: boolean, errorCode?: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: fetchOk,
    status: fetchOk ? 200 : 409,
    json: async () =>
      fetchOk
        ? { success: true }
        : { error: "Role has members", code: errorCode ?? "ROLE_HAS_MEMBERS" },
  }) as unknown as typeof fetch;
}

async function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: /eliminar/i }));
}

describe("RoleDeleteDialog (PR7.5)", () => {
  it("T7.5-1 — DELETE is NOT called when dialog opens (needs confirmation)", async () => {
    setup(true);
    render(
      <RoleDeleteDialog orgSlug="test-org" roleSlug="facturador" roleName="Facturador" onDeleted={vi.fn()} />,
    );
    await openDialog();

    // Dialog visible with role name
    expect(screen.getByText(/facturador/i)).toBeInTheDocument();

    // fetch NOT called yet
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("T7.5-2 — DELETE called only after confirmation button clicked", async () => {
    setup(true);
    const onDeleted = vi.fn();
    render(
      <RoleDeleteDialog orgSlug="test-org" roleSlug="facturador" roleName="Facturador" onDeleted={onDeleted} />,
    );
    await openDialog();

    // Click the confirmation button
    fireEvent.click(screen.getByRole("button", { name: /confirmar eliminación/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/organizations/test-org/roles/facturador",
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  });

  it("T7.5-3 — 409 ROLE_HAS_MEMBERS shown as inline error", async () => {
    setup(false, "ROLE_HAS_MEMBERS");
    render(
      <RoleDeleteDialog orgSlug="test-org" roleSlug="facturador" roleName="Facturador" onDeleted={vi.fn()} />,
    );
    await openDialog();

    fireEvent.click(screen.getByRole("button", { name: /confirmar eliminación/i }));

    await waitFor(() => {
      expect(screen.getByText(/miembros asignados/i)).toBeInTheDocument();
    });

    // Dialog stays open
    expect(screen.getByText(/facturador/i)).toBeInTheDocument();
  });
});
