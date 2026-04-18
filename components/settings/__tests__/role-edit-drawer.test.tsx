/**
 * PR7.4 RED — <RoleEditDrawer> (matrix toggle grid + canPost)
 * PR5.1 RED — Drawer Integration assertions (roles-matrix-ux)
 *
 * REQ: CR.5-S1, CR.5-S2, CR.2-S3, U.5-S1, U.5-S2
 *      REQ-RM.5, REQ-RM.6, REQ-RM.7, REQ-RM.8, REQ-RM.15,
 *      REQ-RM.21, REQ-RM.22, REQ-RM.23, REQ-RM.24
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

  it("T7.4-5 — W-2: drawer reflects new role matrix when role prop changes (key remount)", () => {
    setupFetch();
    const { rerender } = render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );

    // Simulate role prop changing (new role passed after router.refresh())
    // key={role.id} causes full remount — drawer resets to closed state with new role data
    const newRole: CustomRoleShape = {
      id: "r2",
      slug: "contador",
      name: "Contador",
      isSystem: false,
      permissionsRead: ["members"],
      permissionsWrite: [],
      canPost: [],
    };

    rerender(
      <RoleEditDrawer orgSlug="test-org" role={newRole} onUpdated={vi.fn()} />,
    );

    // Open the drawer for the new role — it should initialize from newRole's data
    openDrawer();

    // 'sales' read should NOT be checked (newRole doesn't have sales in permissionsRead)
    expect(screen.getByTestId("toggle-read-sales")).not.toBeChecked();
    // 'members' read SHOULD be checked (newRole has members in permissionsRead)
    expect(screen.getByTestId("toggle-read-members")).toBeChecked();
  });
});

// ─── PR5.1 [RED] — Drawer Integration assertions ────────────────────────────
//
// These 9 tests assert the new behaviour AFTER refactoring role-edit-drawer.tsx
// in PR5.2. They are expected to FAIL now against the old flat-table drawer.
//
// REQ-RM.5, RM.6, RM.7, RM.8, RM.15, RM.21, RM.22, RM.23, RM.24
//
// NOTE: If Radix Sheet portal blocks portaled content from appearing in jsdom,
// we apply vi.mock("@/components/ui/sheet") at the RED step. Failure mode to
// confirm: assertions finding zero checkboxes after openDrawer().

describe("RoleEditDrawer — PR5 Integration (roles-matrix-ux)", () => {
  it("PR5-a — grouped matrix sections render (Contabilidad, Granjas, Organización)", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    // "Contabilidad" appears in both matrix section heading AND sidebar preview heading
    // (dual-mount also renders it twice in preview) — use getAllByText
    expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Granjas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Organización").length).toBeGreaterThan(0);
  });

  it("PR5-b — old 'Contabilizar' heading is gone", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    expect(screen.queryByText(/contabilizar/i)).not.toBeInTheDocument();
  });

  it("PR5-c — toggling Ver checkbox updates state; re-render reflects checked state", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    // 'farms' is not in CUSTOM_ROLE.permissionsRead → should be unchecked
    const farmsRead = screen.getByTestId("toggle-read-farms");
    expect(farmsRead).not.toBeChecked();

    fireEvent.click(farmsRead);
    expect(farmsRead).toBeChecked();
  });

  it("PR5-d — Save sends PATCH with { permissionsRead, permissionsWrite, canPost } only", async () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/organizations/test-org/roles/facturador",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body) as Record<string, unknown>;
    const keys = Object.keys(body).sort();
    expect(keys).toEqual(["canPost", "permissionsRead", "permissionsWrite"]);
  });

  it("PR5-e — system role: all checkboxes are disabled", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={SYSTEM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes.forEach((cb) => {
      expect(cb).toBeDisabled();
    });
  });

  it("PR5-f — system role: Save button is absent or disabled", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={SYSTEM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    const saveButton = screen.queryByRole("button", { name: /guardar/i });
    if (saveButton) {
      expect(saveButton).toBeDisabled();
    } else {
      // Acceptable: button removed entirely for system roles
      expect(saveButton).toBeNull();
    }
  });

  it("PR5-g — system role: grouped matrix still renders (read-only view)", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={SYSTEM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    // "Contabilidad" appears in matrix section heading + preview — use getAllByText
    expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
  });

  it("PR5-h — desktop: preview pane (preview-desktop) present in DOM after open", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    expect(screen.getByTestId("preview-desktop")).toBeInTheDocument();
  });

  it("PR5-i — mobile: <details> wrapper with <summary> present", () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    expect(screen.getByTestId("preview-mobile")).toBeInTheDocument();
  });
});

// ─── PR5.3 [RED] — Payload shape contract (REQ-RM.23, REQ-RM.24) ─────────────
//
// Verifies that handleSave() sends EXACTLY { permissionsRead, permissionsWrite, canPost }
// — no extra keys, no missing keys. Shape frozen from custom-roles (CLOSED).

describe("RoleEditDrawer — PR5.3 Payload shape (REQ-RM.23, REQ-RM.24)", () => {
  it("PR5.3-a — PATCH body has exactly three keys: permissionsRead, permissionsWrite, canPost", async () => {
    setupFetch();
    render(
      <RoleEditDrawer orgSlug="test-org" role={CUSTOM_ROLE} onUpdated={vi.fn()} />,
    );
    openDrawer();

    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body) as Record<string, unknown>;
    const keys = Object.keys(body).sort();

    // Exactly these three keys — no extras, no renamings
    expect(keys).toEqual(["canPost", "permissionsRead", "permissionsWrite"]);

    // Each is an array
    expect(Array.isArray(body.permissionsRead)).toBe(true);
    expect(Array.isArray(body.permissionsWrite)).toBe(true);
    expect(Array.isArray(body.canPost)).toBe(true);

    // Arrays contain only strings
    (body.permissionsRead as unknown[]).forEach((v) =>
      expect(typeof v).toBe("string"),
    );
    (body.permissionsWrite as unknown[]).forEach((v) =>
      expect(typeof v).toBe("string"),
    );
    (body.canPost as unknown[]).forEach((v) => expect(typeof v).toBe("string"));
  });
});

// ─── PR5.5 [RED] — Warning integration smoke tests in drawer ────────────────
//
// REQ-RM.16, REQ-RM.17, REQ-RM.18, REQ-RM.19
// Verifies warnings are rendered inside the drawer based on the current toggle state.

describe("RoleEditDrawer — PR5.5 Warning integration (REQ-RM.16–19)", () => {
  it("PR5.5-a — empty readSet → empty-sidebar warning visible", () => {
    setupFetch();
    const emptyRole: CustomRoleShape = {
      ...CUSTOM_ROLE,
      permissionsRead: [],
      permissionsWrite: [],
      canPost: [],
    };
    render(
      <RoleEditDrawer orgSlug="test-org" role={emptyRole} onUpdated={vi.fn()} />,
    );
    openDrawer();

    // Warning badge renders — dual-mount may produce multiple matches; use getAllByText
    const matches = screen.getAllByText(/este rol no va a ver ningún módulo/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("PR5.5-b — writeSet={sales} with empty readSet → write-without-read warning visible", () => {
    setupFetch();
    const writeOnlyRole: CustomRoleShape = {
      ...CUSTOM_ROLE,
      permissionsRead: [],
      permissionsWrite: ["sales"],
      canPost: [],
    };
    render(
      <RoleEditDrawer orgSlug="test-org" role={writeOnlyRole} onUpdated={vi.fn()} />,
    );
    openDrawer();

    // write-without-read warning for Ventas — message is unique to warning badge
    expect(
      screen.getByText(/activaste editar en "ventas" sin ver/i),
    ).toBeInTheDocument();
  });

  it("PR5.5-c — Save button enabled despite active warnings (warnings are soft)", () => {
    setupFetch();
    const emptyRole: CustomRoleShape = {
      ...CUSTOM_ROLE,
      permissionsRead: [],
      permissionsWrite: [],
      canPost: [],
    };
    render(
      <RoleEditDrawer orgSlug="test-org" role={emptyRole} onUpdated={vi.fn()} />,
    );
    openDrawer();

    const saveButton = screen.getByRole("button", { name: /guardar/i });
    expect(saveButton).not.toBeDisabled();
  });
});
