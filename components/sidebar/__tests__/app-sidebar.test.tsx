/**
 * AppSidebar tests — PR3 refactor.
 *
 * Post-PR3 composition:
 *   <aside>
 *     <header>collapse toggle</header>
 *     <ScrollArea>
 *       <TooltipProvider>
 *         <ModuleSwitcher />
 *         <ActiveModuleNav module={activeModule} orgSlug={orgSlug} />
 *         <CrossModuleNav orgSlug={orgSlug} onOpenAgentChat={...} />
 *       </TooltipProvider>
 *     </ScrollArea>
 *     <SidebarFooter orgSlug={orgSlug} />
 *   </aside>
 *
 * The flat `navItems[]` array is GONE. Contabilidad navItems are rendered
 * by <ActiveModuleNav> only when `useActiveModule()` returns the
 * contabilidad module (route-derived, e.g. pathname /orgX/accounting/...).
 *
 * Test migration log (pre-PR3 tests → PR3):
 *   - "renders exactly one Informes child" → REWRITTEN (setup accounting pathname)
 *   - "'Informes' href points to /{orgSlug}/informes" → REWRITTEN
 *   - 'no child labelled "Reportes"' → REWRITTEN
 *   - 'no child labelled "Estados Financieros"' → REWRITTEN
 *   - "hides Contabilidad accordion when matrix denies journal" → REWRITTEN
 *     (now: assert Contabilidad absent from switcher + Miembros absent from
 *     cross-module nav when all accounting + members resources denied)
 *   - "shows only allowed top-level items when matrix restricts role" → REWRITTEN
 *     (now: granjas-only user sees Granjas in switcher and Mis Granjas link)
 *   - "renders nothing gated-by-role when snapshot is null (loading)" → REWRITTEN
 *     (now: switcher has no options, nav renders nothing; SidebarFooter ALWAYS
 *     renders Configuración — not gated, per design)
 *   - "renders Informes even when other top-level entries are present" (triangulation) → REWRITTEN
 *   - "renders exactly one occurrence of Informes (idempotency)" → REWRITTEN
 *
 * New PR3.7 composition tests (ADDED): switcher + active-module-nav +
 * cross-module-nav + sidebar-footer all render; no flat accordion-button
 * for Contabilidad (it's the switcher trigger now).
 *
 * Environment: jsdom (.test.tsx)
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppSidebar } from "../app-sidebar";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import type { ClientMatrixSnapshot } from "@/components/common/roles-matrix-provider";

// ---------------------------------------------------------------------------
// Mocks — must come before any import of production modules
// ---------------------------------------------------------------------------

// Dynamic pathname holder — tests set `mockPathname` before render()
let mockPathname = "/test-org/farms";

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
  usePathname: () => mockPathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// PR5.6: useActiveModule now calls useClerk — stub it to avoid ClerkProvider requirement
vi.mock("@clerk/nextjs", () => ({
  useClerk: () => ({
    addListener: vi.fn(() => () => {}),
  }),
}));

// PR5.2: useActiveModule calls toast.info — stub sonner to avoid rendering issues
vi.mock("sonner", () => ({
  toast: { info: vi.fn() },
}));

// Collapse state — default expanded, not mobile
vi.mock("../sidebar-provider", () => ({
  useSidebar: () => ({
    isCollapsed: false,
    isMobileOpen: false,
    toggleSidebar: vi.fn(),
    toggleMobile: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

const OWNER_FULL: ClientMatrixSnapshot = {
  orgId: "test-org-id",
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
  permissionsWrite: [
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
  canPost: ["sales", "purchases", "journal"],
};

/** A user with no accounting and no members/documents — only farms + agent */
const FARMS_ONLY: ClientMatrixSnapshot = {
  orgId: "test-org-id",
  role: "member",
  permissionsRead: ["farms", "agent"],
  permissionsWrite: [],
  canPost: [],
};

/** A user who is restricted to granjas tree (farms + documents + agent) */
const RESTRICTED: ClientMatrixSnapshot = {
  orgId: "test-org-id",
  role: "custom",
  permissionsRead: ["farms", "documents", "agent"],
  permissionsWrite: [],
  canPost: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function WithProvider({
  snapshot,
  children,
}: {
  snapshot: ClientMatrixSnapshot | null;
  children: ReactNode;
}) {
  return <RolesMatrixProvider snapshot={snapshot}>{children}</RolesMatrixProvider>;
}

function renderSidebar(
  snapshot: ClientMatrixSnapshot | null = OWNER_FULL,
  pathname = "/test-org/farms",
) {
  mockPathname = pathname;
  return render(
    <WithProvider snapshot={snapshot}>
      <AppSidebar onOpenAgentChat={vi.fn()} />
    </WithProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  mockPathname = "/test-org/farms";
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// PR5 (informes-catalog) migration — Contabilidad section wiring
// These tests require the active module to be contabilidad → set pathname.
// ---------------------------------------------------------------------------

describe("AppSidebar — Contabilidad nav wiring (migrated from PR5 tests)", () => {
  it('renders exactly one "Informes" child link when contabilidad is the active module', () => {
    renderSidebar(OWNER_FULL, "/test-org/accounting/journal");
    const informesLinks = screen
      .getAllByRole("link")
      .filter((el) => el.textContent?.trim() === "Informes");
    expect(informesLinks).toHaveLength(1);
  });

  it('"Informes" href points to /{orgSlug}/informes', () => {
    renderSidebar(OWNER_FULL, "/test-org/accounting/journal");
    const informesLink = screen.getByRole("link", { name: "Informes" });
    expect(informesLink.getAttribute("href")).toBe("/test-org/informes");
  });

  it('does NOT render any child entry labelled "Reportes"', () => {
    renderSidebar(OWNER_FULL, "/test-org/accounting/journal");
    const reportes = screen
      .queryAllByRole("link")
      .filter((el) => el.textContent?.trim() === "Reportes");
    expect(reportes).toHaveLength(0);
  });

  it('does NOT render any child entry labelled "Estados Financieros"', () => {
    renderSidebar(OWNER_FULL, "/test-org/accounting/journal");
    const ef = screen
      .queryAllByRole("link")
      .filter((el) => el.textContent?.trim() === "Estados Financieros");
    expect(ef).toHaveLength(0);
  });

  it("renders Informes alongside Contactos and Libro Diario (triangulation)", () => {
    // sidebar-reorg-settings-hub C1: Plan de Cuentas moved out of Contabilidad
    // sidebar (now a Settings hub card). Triangulate with Contactos instead.
    renderSidebar(OWNER_FULL, "/test-org/accounting/journal");
    const labels = screen.getAllByRole("link").map((el) => el.textContent?.trim() ?? "");
    expect(labels).toContain("Informes");
    expect(labels).toContain("Contactos");
    expect(labels).toContain("Libro Diario");
  });

  it("renders exactly one occurrence of Informes (idempotency)", () => {
    renderSidebar(OWNER_FULL, "/test-org/accounting/journal");
    const count = screen
      .getAllByRole("link")
      .filter((el) => el.textContent?.trim() === "Informes").length;
    expect(count).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// PR7.1 migration — RBAC gating now split between ModuleSwitcher + CrossModuleNav
// ---------------------------------------------------------------------------

describe("AppSidebar — RBAC gating (migrated from PR7.1)", () => {
  it("hides Miembros in the cross-module section when members access is denied", () => {
    // FARMS_ONLY has no members — cross-module nav must hide Miembros
    renderSidebar(FARMS_ONLY, "/test-org/farms");
    expect(screen.queryByRole("link", { name: /Miembros/i })).toBeNull();
  });

  it("shows Mis Granjas link for a restricted user on the farms route (granjas is active)", () => {
    // RESTRICTED has farms — pathname /farms routes to granjas → ActiveModuleNav
    // renders granjas.navItems which includes Mis Granjas.
    renderSidebar(RESTRICTED, "/test-org/farms");
    expect(screen.getByRole("link", { name: /Mis Granjas/i })).toBeTruthy();
  });

  it("does NOT render Contabilidad navItems when user has no accounting access (module not in switcher + not the active module)", () => {
    // RESTRICTED has no accounting resources. Pathname /farms → active module
    // = granjas. Contabilidad navItems (e.g. Libro Diario) must NOT render.
    renderSidebar(RESTRICTED, "/test-org/farms");
    expect(screen.queryByRole("link", { name: /Libro Diario/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Plan de Cuentas/i })).toBeNull();
  });

  it("hides ALL resource-gated items when snapshot is null (loading); only ungated SidebarFooter renders", () => {
    // PR4 contract: per-child RBAC in ActiveModuleNav denies by default
    // when matrix is null. Combined with PR3's cross-module filter and
    // ModuleSwitcher visibility gate, NOTHING permission-gated renders
    // while the matrix is loading.
    //   - ModuleSwitcher: no visibleModules
    //   - CrossModuleNav: each entry gated → all absent
    //   - ActiveModuleNav: every Granjas/Contabilidad navItem has a
    //     resource → deny-by-default means no links render, parent hides
    //     (PR4.4 empty-parent rule).
    // Only the ungated SidebarFooter (Configuración) stays visible.
    renderSidebar(null, "/test-org/farms");

    // Gated cross-module items — absent while matrix is loading
    expect(screen.queryByRole("button", { name: /Agente IA/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Miembros/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Documentos/i })).toBeNull();

    // PR4 contract: per-child RBAC denies Mis Granjas under null matrix
    expect(screen.queryByRole("link", { name: /Mis Granjas/i })).toBeNull();

    // Footer Configuración link is NOT gated and must still render
    expect(screen.getByRole("link", { name: /Configuración/i })).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PR3.7 — Composition (REQ-MS.16 stability + structural wiring)
// Asserts the refactored composition: switcher + 3 sub-components present,
// no flat-navItems remnants, no sidebar-provider import for module state.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// PR4.7 — REQ-MS.8: Legacy parent-level filter removed.
// Module-level visibility is now governed EXCLUSIVELY by <ModuleSwitcher>'s
// `visibleModules`. There must be no remaining parent-level
// `canAccess("journal","read")` (or similar) gate wrapping the whole
// Contabilidad section inside <AppSidebar>. Concretely:
//   - User with at least one accounting resource → Contabilidad visible in
//     switcher AND its navItems (per-child RBAC filtered) rendered.
//   - User with zero accounting resources → Contabilidad absent from switcher
//     (PR2's job), and ActiveModuleNav only renders items the user can see.
// ---------------------------------------------------------------------------

describe("AppSidebar — no legacy parent-level filter (REQ-MS.8)", () => {
  it("user with only 'journal' access sees Contabilidad in switcher + Libro Diario (per-child pass-through)", () => {
    const journalOnly: ClientMatrixSnapshot = {
      orgId: "test-org-id",
      role: "contador",
      permissionsRead: ["journal"],
      permissionsWrite: [],
      canPost: [],
    };
    renderSidebar(journalOnly, "/test-org/accounting/journal");

    // Contabilidad trigger IS in the switcher (module has ≥1 resource accessible)
    const triggers = screen.getAllByRole("button");
    const contabTrigger = triggers.find(
      (btn) => btn.textContent?.trim() === "Contabilidad",
    );
    expect(contabTrigger).toBeTruthy();

    // Libro Diario (journal) IS rendered in ActiveModuleNav
    expect(screen.getByRole("link", { name: /Libro Diario/i })).toBeTruthy();
    // But Ventas (dispatches, denied) is NOT rendered
    expect(
      screen.queryByRole("link", { name: /Ventas/i }),
    ).toBeNull();
  });

  it("user with zero accounting resources sees NO Contabilidad switcher trigger", () => {
    // FARMS_ONLY has farms + agent, nothing accounting. Contabilidad module
    // is NOT in visibleModules. The switcher trigger shows the active module
    // label — with no accounting + route=/farms → active is granjas. So the
    // switcher shows "Granjas", and NO button labelled "Contabilidad" exists.
    renderSidebar(FARMS_ONLY, "/test-org/farms");
    const buttons = screen.getAllByRole("button");
    const contabButtons = buttons.filter(
      (btn) => btn.textContent?.trim() === "Contabilidad",
    );
    expect(contabButtons).toHaveLength(0);
  });
});

describe("AppSidebar — PR3 composition (REQ-MS.16)", () => {
  it("renders the ModuleSwitcher (active module trigger) above nav", () => {
    renderSidebar(OWNER_FULL, "/test-org/accounting/journal");
    // The switcher renders a button whose visible text is the active module
    // label ("Contabilidad" for the accounting route).
    const triggers = screen.getAllByRole("button");
    const switcherTrigger = triggers.find((btn) => btn.textContent?.trim() === "Contabilidad");
    expect(switcherTrigger).toBeTruthy();
  });

  it("renders the Granjas switcher label when pathname is /farms (route-derived active module)", () => {
    renderSidebar(OWNER_FULL, "/test-org/farms");
    const triggers = screen.getAllByRole("button");
    const switcherTrigger = triggers.find((btn) => btn.textContent?.trim() === "Granjas");
    expect(switcherTrigger).toBeTruthy();
  });

  it("renders the Configuración link (SidebarFooter)", () => {
    renderSidebar(OWNER_FULL, "/test-org/farms");
    const link = screen.getByRole("link", { name: /Configuración/i });
    expect(link.getAttribute("href")).toBe("/test-org/settings");
  });

  it("renders Agente IA + Documentos (CrossModuleNav) for a full-access user — Miembros + Auditoría moved to Settings", () => {
    // C2 sidebar-reorg-settings-hub: cross-module nav trimmed to Agente IA
    // and Documentos. Miembros is a Settings card; Auditoría becomes a
    // Settings card in C3.
    renderSidebar(OWNER_FULL, "/test-org/farms");
    expect(screen.getByRole("button", { name: /Agente IA/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Documentos/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Miembros/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Auditoría/i })).toBeNull();
  });

  it("renders Mis Granjas (ActiveModuleNav) when pathname is /farms", () => {
    renderSidebar(OWNER_FULL, "/test-org/farms");
    expect(screen.getByRole("link", { name: /Mis Granjas/i })).toBeTruthy();
  });

  it("does NOT render Contabilidad as an accordion button (flat navItems gone)", () => {
    // Pre-PR3: Contabilidad was a <button> wrapping an accordion of children.
    // Post-PR3: Contabilidad is the ModuleSwitcher's active-module label (a
    // button, yes — but clicking opens the DropdownMenu, NOT an inline
    // accordion inside the sidebar). We assert the switcher trigger button
    // is the ONLY button labelled "Contabilidad" — no second button acting
    // as an accordion trigger for the old flat nav.
    renderSidebar(OWNER_FULL, "/test-org/accounting/journal");
    const contabButtons = screen
      .getAllByRole("button")
      .filter((btn) => btn.textContent?.trim() === "Contabilidad");
    // Exactly one — the switcher trigger. No accordion button.
    expect(contabButtons).toHaveLength(1);
  });
});
