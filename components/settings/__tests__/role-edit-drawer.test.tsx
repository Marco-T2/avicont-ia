/**
 * PR7.4 RED — <RoleEditDrawer> (matrix toggle grid + canPost)
 *
 * REQ: CR.5-S1, CR.5-S2, CR.2-S3, U.5-S1, U.5-S2
 * (a) drawer opens with role's current matrix
 * (b) toggle read cell → PATCH called with updated permissionsRead
 * (c) canPost toggle → PATCH called with updated canPost
 * (d) system role → inputs disabled (no edit controls)
 */

import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RoleEditDrawer from "../role-edit-drawer";
import type { CustomRoleShape } from "../role-edit-drawer";

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

const CUSTOM_ROLE: CustomRoleShape = {
  id: "r1",
  slug: "facturador",
  name: "Facturador",
  isSystem: false,
  permissionsRead: ["sales", "contacts"],
  permissionsWrite: ["sales"],
  canPost: [],
};

const SYSTEM_ROLE: CustomRoleShape = {
  id: "r0",
  slug: "admin",
  name: "Admin",
  isSystem: true,
  permissionsRead: ["sales", "members"],
  permissionsWrite: ["sales", "members"],
  canPost: ["sales"],
};

function setupFetch(ok = true) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    json: async () => (ok ? { role: CUSTOM_ROLE } : { error: "Error" }),
  }) as unknown as typeof fetch;
}

function openDrawer() {
  fireEvent.click(screen.getByRole("button", { name: /editar/i }));
}

describe("RoleEditDrawer (PR7.4)", () => {
  it("T7.4-1 — drawer opens and shows role name", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    expect(screen.getByText(/facturador/i)).toBeInTheDocument();
  });

  it("T7.4-2 — read cell toggle → PATCH called with updated permissionsRead", async () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    // 'contacts' is currently in permissionsRead — uncheck it
    const contactsReadCheckbox = screen.getByTestId("toggle-read-contacts");
    expect(contactsReadCheckbox).toBeChecked();
    fireEvent.click(contactsReadCheckbox);

    // save
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/organizations/test-org/roles/facturador",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.permissionsRead).not.toContain("contacts");
  });

  it("T7.4-3 — canPost toggle → PATCH called with updated canPost", async () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    // 'sales' canPost is off → check it
    const salesPostCheckbox = screen.getByTestId("toggle-canpost-sales");
    expect(salesPostCheckbox).not.toBeChecked();
    fireEvent.click(salesPostCheckbox);

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/organizations/test-org/roles/facturador",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.canPost).toContain("sales");
  });

  it("T7.4-4 — system role → checkboxes are all disabled", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={SYSTEM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    // All toggles should be disabled
    const checkboxes = screen.getAllByRole("checkbox");
    checkboxes.forEach((cb) => {
      expect(cb).toBeDisabled();
    });
  });
});
