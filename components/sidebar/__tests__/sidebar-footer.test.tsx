/**
 * PR3.3 [RED] — REQ-MS.9 (footer): SidebarFooter renders Configuración link.
 *
 * Per the design (design.md "File Changes" + PR3 section): the footer is
 * org-level, NOT module-scoped. The link is always visible — no RBAC gate —
 * so that navigation to Configuración remains reachable even when the active
 * module has no nav items (granjas) or when the user has no accounting
 * access (the link itself points to the shared settings hub).
 *
 * Environment: jsdom (.test.tsx)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import type { ClientMatrixSnapshot } from "@/components/common/roles-matrix-provider";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
  usePathname: () => "/test-org/farms",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../sidebar-provider", () => ({
  useSidebar: () => ({
    isCollapsed: false,
    isMobileOpen: false,
    toggleSidebar: vi.fn(),
    toggleMobile: vi.fn(),
  }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Import production module AFTER mocks
// ---------------------------------------------------------------------------

import { SidebarFooter } from "../sidebar-footer";

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

const OWNER: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "owner",
  permissionsRead: ["accounting-config", "farms", "journal"],
  permissionsWrite: [],
  canPost: [],
};

const MEMBER_NO_CONFIG: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "member",
  permissionsRead: ["farms"],
  permissionsWrite: [],
  canPost: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderFooter(snapshot: ClientMatrixSnapshot | null, orgSlug = "test-org") {
  return render(
    <RolesMatrixProvider snapshot={snapshot}>
      <SidebarFooter orgSlug={orgSlug} />
    </RolesMatrixProvider>
  );
}

afterEach(cleanup);

// ---------------------------------------------------------------------------
// PR3.3 — SidebarFooter renders Configuración link (no RBAC gate)
// ---------------------------------------------------------------------------

describe("SidebarFooter — Configuración link (REQ-MS.9 footer)", () => {
  it("renders a Configuración link for the owner role", () => {
    renderFooter(OWNER);
    expect(screen.getByRole("link", { name: /Configuración/i })).toBeTruthy();
  });

  it("renders a Configuración link for a member with no accounting-config access (no RBAC gate)", () => {
    renderFooter(MEMBER_NO_CONFIG);
    // Per design: the footer link is org-level and NOT gated by a resource.
    // Always visible (verified at null matrix too below).
    expect(screen.getByRole("link", { name: /Configuración/i })).toBeTruthy();
  });

  it("renders a Configuración link even when the matrix snapshot is null (loading)", () => {
    renderFooter(null);
    expect(screen.getByRole("link", { name: /Configuración/i })).toBeTruthy();
  });

  it("Configuración link points to /{orgSlug}/settings", () => {
    renderFooter(OWNER);
    const link = screen.getByRole("link", { name: /Configuración/i });
    expect(link.getAttribute("href")).toBe("/test-org/settings");
  });

  it("uses the provided orgSlug when building the settings href", () => {
    renderFooter(OWNER, "acme-corp");
    const link = screen.getByRole("link", { name: /Configuración/i });
    expect(link.getAttribute("href")).toBe("/acme-corp/settings");
  });
});

// ---------------------------------------------------------------------------
// Theme toggle wired in the footer (above Configuración)
// ---------------------------------------------------------------------------

describe("SidebarFooter — theme toggle", () => {
  it("renders the theme toggle button above the Configuración link", () => {
    const { container } = renderFooter(OWNER);
    const toggle = screen.getByRole("button", { name: /tema oscuro/i });
    const link = screen.getByRole("link", { name: /Configuración/i });
    expect(toggle).toBeTruthy();
    // DOM order: toggle should appear before the link
    const interactives = Array.from(
      container.querySelectorAll("button, a"),
    );
    expect(interactives.indexOf(toggle)).toBeLessThan(
      interactives.indexOf(link),
    );
  });
});
