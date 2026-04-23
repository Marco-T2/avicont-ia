// [PR1 regression gate] must pass before and after import swap (PR1.4).
// This file is READ-ONLY for PR1. Do NOT modify existing assertions.
// All 15 tests in this file must remain green after dropOrphanSeparators
// is extracted from active-module-nav.tsx to lib/sidebar/drop-orphan-separators.ts.

/**
 * PR3.5 [RED] — REQ-MS.7 wiring (no per-child RBAC yet — that's PR4):
 * ActiveModuleNav renders the active module's navItems through <NavItem>,
 * pre-resolving each navItem.href(orgSlug) into a static string so that
 * NavItem's API (static href) stays untouched.
 *
 * This phase asserts STRUCTURAL wiring only:
 *   - All navItems render (no per-child RBAC filter at this stage)
 *   - Separators render
 *   - Null active module renders nothing
 *   - Empty module (navItems: []) renders nothing
 *
 * Per-child RBAC filtering belongs to PR4 and is NOT tested here.
 *
 * Environment: jsdom (.test.tsx)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import type { ClientMatrixSnapshot } from "@/components/common/roles-matrix-provider";
import type { Module } from "../modules/registry";

// ---------------------------------------------------------------------------
// Mocks — top-level, before any import of production modules
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

// ---------------------------------------------------------------------------
// Import production module AFTER mocks
// ---------------------------------------------------------------------------

import { ActiveModuleNav } from "../active-module-nav";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const OWNER: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "owner",
  permissionsRead: [
    "members",
    "accounting-config",
    "sales",
    "purchases",
    "payments",
    "journal",
    "dispatches",
    "reports",
    "contacts",
    "farms",
    "documents",
    "agent",
  ],
  permissionsWrite: [],
  canPost: [],
};

/** Minimal granjas-like module with one link */
const GRANJAS_MODULE: Module = {
  id: "granjas",
  label: "Granjas",
  icon: null,
  resources: ["farms"],
  homeRoute: (slug) => `/${slug}/farms`,
  navItems: [
    {
      label: "Mis Granjas",
      href: (slug) => `/${slug}/farms`,
      resource: "farms",
    },
  ],
};

/** Contabilidad-like module with separators + multiple links */
const CONTAB_MODULE: Module = {
  id: "contabilidad",
  label: "Contabilidad",
  icon: null,
  resources: ["journal", "sales"],
  homeRoute: (slug) => `/${slug}/accounting`,
  navItems: [
    { label: "Operaciones", isSeparator: true },
    {
      label: "Ventas y Despachos",
      href: (slug) => `/${slug}/dispatches`,
      resource: "sales",
    },
    {
      label: "Compras y Servicios",
      href: (slug) => `/${slug}/purchases`,
      resource: "purchases",
    },
    { label: "Contabilidad", isSeparator: true },
    {
      label: "Libro Diario",
      href: (slug) => `/${slug}/accounting/journal`,
      resource: "journal",
    },
  ],
};

/** A module with no navItems at all (edge case) */
const EMPTY_MODULE: Module = {
  id: "granjas",
  label: "Granjas",
  icon: null,
  resources: ["farms"],
  homeRoute: (slug) => `/${slug}/farms`,
  navItems: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderNav(module: Module | null, orgSlug = "test-org") {
  return render(
    <RolesMatrixProvider snapshot={OWNER}>
      <ActiveModuleNav module={module} orgSlug={orgSlug} />
    </RolesMatrixProvider>
  );
}

afterEach(cleanup);

// ---------------------------------------------------------------------------
// PR3.5 — Structural wiring
// ---------------------------------------------------------------------------

describe("ActiveModuleNav — renders active module's navItems (REQ-MS.7 wiring)", () => {
  it("renders the single Mis Granjas link for the granjas module", () => {
    renderNav(GRANJAS_MODULE);
    expect(screen.getByRole("link", { name: /Mis Granjas/i })).toBeTruthy();
  });

  it("resolves the href by calling navItem.href(orgSlug) — points to /{orgSlug}/farms", () => {
    renderNav(GRANJAS_MODULE, "acme-corp");
    const link = screen.getByRole("link", { name: /Mis Granjas/i });
    expect(link.getAttribute("href")).toBe("/acme-corp/farms");
  });

  it("renders all Contabilidad navItem links (no per-child filter in PR3)", () => {
    renderNav(CONTAB_MODULE);
    // All three links should be present (NavItem resolves clicks/expansion itself;
    // these are top-level links since we are passing a flat navItems list).
    expect(screen.getByRole("link", { name: /Ventas y Despachos/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Compras y Servicios/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Libro Diario/i })).toBeTruthy();
  });

  it("resolves every navItem's href with the provided orgSlug", () => {
    renderNav(CONTAB_MODULE, "test-org");
    expect(
      screen.getByRole("link", { name: /Ventas y Despachos/i }).getAttribute("href")
    ).toBe("/test-org/dispatches");
    expect(
      screen.getByRole("link", { name: /Libro Diario/i }).getAttribute("href")
    ).toBe("/test-org/accounting/journal");
  });

  it("renders separator labels (Operaciones, Contabilidad section headings)", () => {
    renderNav(CONTAB_MODULE);
    // Separator labels are visual section headings — rendered as text
    expect(screen.getByText("Operaciones")).toBeTruthy();
    // Note: "Contabilidad" is both a separator label and the module's label.
    // We assert that at least one element with exact text "Contabilidad" exists.
    const contabNodes = screen.getAllByText((_, el) => el?.textContent?.trim() === "Contabilidad");
    expect(contabNodes.length).toBeGreaterThanOrEqual(1);
  });

  it("renders nothing when module is null", () => {
    const { container } = renderNav(null);
    // No nav element, no links, no separators
    expect(container.querySelector("nav")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders nothing when module has an empty navItems array", () => {
    const { container } = renderNav(EMPTY_MODULE);
    // No nav, no links
    expect(container.querySelector("nav")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PR4.3 [RED] — REQ-MS.7 edge: Empty-parent rule.
// When per-child RBAC filter removes EVERY non-separator item, the whole
// <ActiveModuleNav> renders null (no empty accordion shell, no dangling
// separator-only nav).
// ---------------------------------------------------------------------------

describe("ActiveModuleNav — empty-parent rule (REQ-MS.7 edge)", () => {
  it("renders null when every navItem is filtered out by RBAC", () => {
    // CONTAB_MODULE has resources journal, dispatches, purchases. Snapshot
    // with NONE of those → every child filtered → render null.
    // Note: 'Ventas y Despachos' now gates on sales, not dispatches (post resource-nav-mapping-fix).
    const deniedSnapshot: ClientMatrixSnapshot = {
      orgId: "org-1",
      role: "member",
      permissionsRead: ["farms"], // nothing relevant to contabilidad
      permissionsWrite: [],
      canPost: [],
    };
    const { container } = render(
      <RolesMatrixProvider snapshot={deniedSnapshot}>
        <ActiveModuleNav module={CONTAB_MODULE} orgSlug="test-org" />
      </RolesMatrixProvider>,
    );
    // No <nav>, no links, no separators
    expect(container.querySelector("nav")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("Operaciones")).toBeNull();
    expect(screen.queryByText("Contabilidad")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PR4.5 [RED] — REQ-MS.7: Separator-hiding.
// A separator (isSeparator=true) whose run (until next separator or end)
// contains NO surviving child must be dropped.
// Four shape cases:
//   (a) all children visible → all separators visible
//   (b) only "Contabilidad"-group children survive → "Operaciones" hidden
//   (c) only "Operaciones"-group children survive → "Contabilidad" hidden
//   (d) zero children → whole nav null (covered by PR4.3, not here)
// ---------------------------------------------------------------------------

describe("ActiveModuleNav — separator-hiding (REQ-MS.7 separator logic)", () => {
  it("(a) shows all separators when every child is visible", () => {
    const fullSnapshot: ClientMatrixSnapshot = {
      orgId: "org-1",
      role: "owner",
      permissionsRead: ["journal", "dispatches", "purchases"],
      permissionsWrite: [],
      canPost: [],
    };
    render(
      <RolesMatrixProvider snapshot={fullSnapshot}>
        <ActiveModuleNav module={CONTAB_MODULE} orgSlug="test-org" />
      </RolesMatrixProvider>,
    );
    expect(screen.getByText("Operaciones")).toBeTruthy();
    // "Contabilidad" exact-match (not substring with module label)
    const contabSep = screen.getAllByText(
      (_, el) => el?.textContent?.trim() === "Contabilidad",
    );
    expect(contabSep.length).toBeGreaterThanOrEqual(1);
  });

  it("(b) hides the Operaciones separator when only Contabilidad-group children survive", () => {
    // User has ONLY journal → all Operaciones-group items (dispatches,
    // purchases) hidden. "Libro Diario" (in Contabilidad group) survives.
    const journalOnly: ClientMatrixSnapshot = {
      orgId: "org-1",
      role: "contador",
      permissionsRead: ["journal"],
      permissionsWrite: [],
      canPost: [],
    };
    render(
      <RolesMatrixProvider snapshot={journalOnly}>
        <ActiveModuleNav module={CONTAB_MODULE} orgSlug="test-org" />
      </RolesMatrixProvider>,
    );
    // Libro Diario IS rendered
    expect(screen.getByRole("link", { name: /Libro Diario/i })).toBeTruthy();
    // Operaciones separator is NOT rendered (all children in that group filtered)
    expect(screen.queryByText("Operaciones")).toBeNull();
    // Contabilidad separator IS rendered (group has survivors)
    expect(
      screen.getAllByText((_, el) => el?.textContent?.trim() === "Contabilidad")
        .length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("(c) hides the Contabilidad separator when only Operaciones-group children survive", () => {
    // User has ONLY sales → Ventas y Despachos survives (gates on sales post
    // resource-nav-mapping-fix); all Contabilidad-group items (journal) filtered.
    const salesOnly: ClientMatrixSnapshot = {
      orgId: "org-1",
      role: "cobrador",
      permissionsRead: ["sales"],
      permissionsWrite: [],
      canPost: [],
    };
    render(
      <RolesMatrixProvider snapshot={salesOnly}>
        <ActiveModuleNav module={CONTAB_MODULE} orgSlug="test-org" />
      </RolesMatrixProvider>,
    );
    // Ventas y Despachos IS rendered
    expect(screen.getByRole("link", { name: /Ventas y Despachos/i })).toBeTruthy();
    // Operaciones separator IS rendered (group has survivor)
    expect(screen.getByText("Operaciones")).toBeTruthy();
    // Contabilidad separator is NOT rendered (all children filtered)
    expect(
      screen.queryByText((_, el) => el?.textContent?.trim() === "Contabilidad"),
    ).toBeNull();
  });

  it("drops a trailing separator when no child follows it (end-of-list case)", () => {
    // Build an ad-hoc module: [child-journal, separator-trailing] where
    // the separator has nothing after it. Even with full access, that
    // separator must be hidden (it's an orphan).
    const TRAILING_SEP_MODULE: Module = {
      id: "granjas",
      label: "Granjas",
      icon: null,
      resources: ["farms"],
      homeRoute: (slug) => `/${slug}/farms`,
      navItems: [
        { label: "Mis Granjas", href: (s) => `/${s}/farms`, resource: "farms" },
        { label: "TrailingSep", isSeparator: true },
      ],
    };
    const fullSnapshot: ClientMatrixSnapshot = {
      orgId: "org-1",
      role: "owner",
      permissionsRead: ["farms"],
      permissionsWrite: [],
      canPost: [],
    };
    render(
      <RolesMatrixProvider snapshot={fullSnapshot}>
        <ActiveModuleNav module={TRAILING_SEP_MODULE} orgSlug="test-org" />
      </RolesMatrixProvider>,
    );
    expect(screen.getByRole("link", { name: /Mis Granjas/i })).toBeTruthy();
    expect(screen.queryByText("TrailingSep")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PR4.1 [RED] — REQ-MS.7: Per-child RBAC filter
// Each navItem with a `resource` is filtered individually via
// matrix.canAccess(resource, "read"). Items without access do NOT render.
// ---------------------------------------------------------------------------

describe("ActiveModuleNav — per-child RBAC filter (REQ-MS.7)", () => {
  it("contador with journal but NOT sales/purchases sees Libro Diario but not Ventas or Compras", () => {
    // Contador can read journal + reports + contacts + payments, but NOT
    // sales, dispatches, or purchases.
    // Ventas y Despachos maps to sales in registry (post resource-nav-mapping-fix).
    const contadorJournalOnly: ClientMatrixSnapshot = {
      orgId: "org-1",
      role: "contador",
      permissionsRead: ["journal"], // ONLY journal — nothing else
      permissionsWrite: [],
      canPost: [],
    };

    render(
      <RolesMatrixProvider snapshot={contadorJournalOnly}>
        <ActiveModuleNav module={CONTAB_MODULE} orgSlug="test-org" />
      </RolesMatrixProvider>
    );

    // Libro Diario (resource=journal) IS visible
    expect(screen.getByRole("link", { name: /Libro Diario/i })).toBeTruthy();
    // Ventas y Despachos (resource=sales) is NOT visible [sales not in readSet;
    // dispatches resource has no nav items after the swap]
    expect(screen.queryByRole("link", { name: /Ventas y Despachos/i })).toBeNull();
    // Compras y Servicios (resource=purchases) is NOT visible
    expect(screen.queryByRole("link", { name: /Compras y Servicios/i })).toBeNull();
  });

  it("null matrix denies every child (deny-by-default) — no links render", () => {
    render(
      <RolesMatrixProvider snapshot={null}>
        <ActiveModuleNav module={CONTAB_MODULE} orgSlug="test-org" />
      </RolesMatrixProvider>
    );
    // Every navItem in CONTAB_MODULE has a resource — all denied
    expect(screen.queryByRole("link", { name: /Libro Diario/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Ventas y Despachos/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Compras y Servicios/i })).toBeNull();
  });

  it("items WITHOUT a resource are always visible (e.g., separators handled as always-render)", () => {
    // Build a module with one resource-less, href-less placeholder item
    // (not a separator). Such items MUST render regardless of matrix.
    const MODULE_NO_RESOURCE: Module = {
      id: "granjas",
      label: "Granjas",
      icon: null,
      resources: ["farms"],
      homeRoute: (slug) => `/${slug}/farms`,
      navItems: [
        // href without resource — always visible
        {
          label: "Always Visible",
          href: (slug) => `/${slug}/always`,
        },
      ],
    };

    const deniedSnapshot: ClientMatrixSnapshot = {
      orgId: "org-1",
      role: "member",
      permissionsRead: [], // nothing
      permissionsWrite: [],
      canPost: [],
    };

    render(
      <RolesMatrixProvider snapshot={deniedSnapshot}>
        <ActiveModuleNav module={MODULE_NO_RESOURCE} orgSlug="test-org" />
      </RolesMatrixProvider>
    );

    expect(screen.getByRole("link", { name: /Always Visible/i })).toBeTruthy();
  });
});
