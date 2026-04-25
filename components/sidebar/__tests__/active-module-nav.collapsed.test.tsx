/**
 * REQ-collapsed-nav — When the sidebar is collapsed:
 *   - Section separators ("Operaciones", "Contabilidad") MUST NOT render
 *     (they would otherwise wrap into broken text like "Oper / Cont").
 *   - Leaf nav items still render (NavItem itself handles icon-only display
 *     and tooltip — that's covered by nav-item's own tests).
 *
 * Environment: jsdom (.test.tsx)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import type { ClientMatrixSnapshot } from "@/components/common/roles-matrix-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Module } from "../modules/registry";

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
  usePathname: () => "/test-org/farms",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../sidebar-provider", () => ({
  useSidebar: () => ({
    isCollapsed: true,
    isMobileOpen: false,
    toggleSidebar: vi.fn(),
    toggleMobile: vi.fn(),
  }),
}));

import { ActiveModuleNav } from "../active-module-nav";

const OWNER: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "owner",
  permissionsRead: ["journal", "sales", "purchases", "farms"],
  permissionsWrite: [],
  canPost: [],
};

const CONTAB_LIKE: Module = {
  id: "contabilidad",
  label: "Contabilidad",
  icon: null,
  resources: ["journal", "sales"],
  homeRoute: (slug) => `/${slug}/accounting`,
  navItems: [
    { label: "Operaciones", isSeparator: true },
    { label: "Ventas y Despachos", href: (s) => `/${s}/dispatches`, resource: "sales" },
    { label: "Contabilidad", isSeparator: true },
    { label: "Libro Diario", href: (s) => `/${s}/accounting/journal`, resource: "journal" },
  ],
};

afterEach(cleanup);

describe("ActiveModuleNav — collapsed mode hides separators", () => {
  it("does NOT render the 'Operaciones' separator label when collapsed", () => {
    render(
      <TooltipProvider>
        <RolesMatrixProvider snapshot={OWNER}>
          <ActiveModuleNav module={CONTAB_LIKE} orgSlug="test-org" />
        </RolesMatrixProvider>
      </TooltipProvider>
    );
    expect(screen.queryByText("Operaciones")).toBeNull();
  });

  it("does NOT render the 'Contabilidad' separator label when collapsed", () => {
    render(
      <TooltipProvider>
        <RolesMatrixProvider snapshot={OWNER}>
          <ActiveModuleNav module={CONTAB_LIKE} orgSlug="test-org" />
        </RolesMatrixProvider>
      </TooltipProvider>
    );
    const contabSep = screen.queryByText(
      (_, el) => el?.textContent?.trim() === "Contabilidad"
    );
    expect(contabSep).toBeNull();
  });

  it("still renders the leaf links when collapsed", () => {
    const { container } = render(
      <TooltipProvider>
        <RolesMatrixProvider snapshot={OWNER}>
          <ActiveModuleNav module={CONTAB_LIKE} orgSlug="test-org" />
        </RolesMatrixProvider>
      </TooltipProvider>
    );
    // In collapsed mode the visible label is hidden — the only accessible
    // name comes from the tooltip on hover, which Testing Library cannot
    // compute statically. Verify by href instead.
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs).toContain("/test-org/dispatches");
    expect(hrefs).toContain("/test-org/accounting/journal");
  });
});
