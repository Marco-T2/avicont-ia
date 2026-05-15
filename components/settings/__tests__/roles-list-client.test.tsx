/**
 * PR7.5 — RolesListClient component tests
 *
 * REQ: CR.2-S3, U.5-S1, U.5-S2
 * - system roles rendered as read-only rows (no Edit/Delete)
 * - custom roles have Edit and Delete buttons
 * - "Create role" button is present
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RolesListClient from "../roles-list-client";
import type { CustomRoleShape } from "../role-edit-drawer";

// W-1 RED: import rerender helper
// (rerender is returned from render() — no extra import needed)

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

const MOCK_ROLES: CustomRoleShape[] = [
  {
    id: "1",
    slug: "owner",
    name: "Owner",
    isSystem: true,
    permissionsRead: [],
    permissionsWrite: [],
    canPost: [],
  },
  {
    id: "2",
    slug: "admin",
    name: "Admin",
    isSystem: true,
    permissionsRead: [],
    permissionsWrite: [],
    canPost: [],
  },
  {
    id: "3",
    slug: "facturador",
    name: "Facturador",
    isSystem: false,
    permissionsRead: ["sales"],
    permissionsWrite: [],
    canPost: [],
  },
];

describe("RolesListClient (PR7.5)", () => {
  it("T7.5-4 — renders list with all roles", () => {
    render(<RolesListClient orgSlug="test-org" initialRoles={MOCK_ROLES} />);

    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Facturador")).toBeInTheDocument();
  });

  it("T7.5-5 — system roles have NO Edit or Delete buttons (but have Ver)", () => {
    render(<RolesListClient orgSlug="test-org" initialRoles={MOCK_ROLES} />);

    // There should be only 1 Edit button (for 'facturador') and 1 Delete button
    const editBtns = screen.getAllByRole("button", { name: /^editar$/i });
    expect(editBtns).toHaveLength(1);

    const deleteBtns = screen.getAllByRole("button", { name: /eliminar/i });
    expect(deleteBtns).toHaveLength(1);
  });

  it("T7.5-9 — system roles have a 'Ver' button (read-only drawer trigger)", () => {
    render(<RolesListClient orgSlug="test-org" initialRoles={MOCK_ROLES} />);

    // MOCK_ROLES has 2 system roles (Owner, Admin) → 2 Ver buttons
    const verBtns = screen.getAllByRole("button", { name: /^ver$/i });
    expect(verBtns).toHaveLength(2);
  });

  it("T7.5-6 — custom roles have both Edit and Delete buttons", () => {
    render(<RolesListClient orgSlug="test-org" initialRoles={MOCK_ROLES} />);

    // The 'facturador' row should have edit + delete
    const editBtns = screen.getAllByRole("button", { name: /editar/i });
    expect(editBtns).toHaveLength(1);
    const deleteBtns = screen.getAllByRole("button", { name: /eliminar/i });
    expect(deleteBtns).toHaveLength(1);
  });

  it("T7.5-7 — Create role button is present", () => {
    render(<RolesListClient orgSlug="test-org" initialRoles={MOCK_ROLES} />);

    expect(screen.getByRole("button", { name: /crear rol/i })).toBeInTheDocument();
  });

  it("T7.5-8 — W-1: list updates when initialRoles prop changes (simulates router.refresh())", () => {
    const { rerender } = render(
      <RolesListClient orgSlug="test-org" initialRoles={MOCK_ROLES} />,
    );

    // Initially Facturador is present
    expect(screen.getByText("Facturador")).toBeInTheDocument();

    // Simulate router.refresh() causing server to pass a new roles list
    const updatedRoles: CustomRoleShape[] = [
      ...MOCK_ROLES.filter((r) => r.slug !== "facturador"),
      {
        id: "4",
        slug: "contador",
        name: "Contador",
        isSystem: false,
        permissionsRead: ["sales", "journal"],
        permissionsWrite: [],
        canPost: [],
      },
    ];

    rerender(<RolesListClient orgSlug="test-org" initialRoles={updatedRoles} />);

    // Old role should be gone; new role should be visible
    expect(screen.queryByText("Facturador")).not.toBeInTheDocument();
    expect(screen.getByText("Contador")).toBeInTheDocument();
  });
});
