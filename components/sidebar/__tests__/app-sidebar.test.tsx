/**
 * Sidebar wiring tests — PR5 (informes-catalog) + PR7.1 (dynamic matrix).
 *
 * Verifies that the Contabilidad section contains exactly ONE "Informes" entry
 * and that the old "Reportes" and "Estados Financieros" entries have been removed.
 *
 * PR7.1: AppSidebar now reads gating decisions from the
 * <RolesMatrixProvider> client context (no more sync static canAccess).
 * We wrap the render with a provider that grants the owner all resources so
 * the Contabilidad accordion and its children are visible.
 *
 * Strategy: render AppSidebar with mocked hooks (useParams, useSidebar,
 * usePathname) + a RolesMatrixProvider with an owner-grants-everything snapshot.
 * Desktop sidebar is always rendered (jsdom has no CSS media queries).
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";
import { AppSidebar } from "../app-sidebar";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";

// ---------------------------------------------------------------------------
// Mocks — must come before any import of the production modules
// ---------------------------------------------------------------------------

// next/navigation — useParams + usePathname
vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
  usePathname: () => "/test-org/farms",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// useSidebar — not collapsed, not mobile
vi.mock("../sidebar-provider", () => ({
  useSidebar: () => ({
    isCollapsed: false,
    isMobileOpen: false,
    toggleSidebar: vi.fn(),
    toggleMobile: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OWNER_FULL = {
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
} as const;

function WithProvider({ children }: { children: ReactNode }) {
  return (
    <RolesMatrixProvider snapshot={{ ...OWNER_FULL, permissionsRead: [...OWNER_FULL.permissionsRead], permissionsWrite: [...OWNER_FULL.permissionsWrite], canPost: [...OWNER_FULL.canPost] }}>
      {children}
    </RolesMatrixProvider>
  );
}

function renderSidebar() {
  return render(
    <WithProvider>
      <AppSidebar onOpenAgentChat={vi.fn()} />
    </WithProvider>,
  );
}

/**
 * Click the "Contabilidad" top-level button to expand its children,
 * then return all visible sub-item link texts.
 */
function getContabilidadChildLabels(): string[] {
  const contabButton = screen.getByRole("button", { name: /Contabilidad/i });
  fireEvent.click(contabButton);

  const links = screen.getAllByRole("link");
  return links.map((el) => el.textContent?.trim() ?? "");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(cleanup);

describe("AppSidebar — Contabilidad section wiring (PR5)", () => {
  it('renders exactly one "Informes" child entry', () => {
    renderSidebar();
    const labels = getContabilidadChildLabels();
    const informesEntries = labels.filter((l) => l === "Informes");
    expect(informesEntries).toHaveLength(1);
  });

  it('"Informes" href points to /{orgSlug}/informes', () => {
    renderSidebar();
    getContabilidadChildLabels();

    const informesLink = screen.getByRole("link", { name: "Informes" });
    expect(informesLink).toHaveAttribute("href", "/test-org/informes");
  });

  it('does NOT render any child entry labelled "Reportes"', () => {
    renderSidebar();
    const labels = getContabilidadChildLabels();
    const reportesEntries = labels.filter((l) => l === "Reportes");
    expect(reportesEntries).toHaveLength(0);
  });

  it('does NOT render any child entry labelled "Estados Financieros"', () => {
    renderSidebar();
    const labels = getContabilidadChildLabels();
    const efEntries = labels.filter((l) => l === "Estados Financieros");
    expect(efEntries).toHaveLength(0);
  });
});

describe("AppSidebar — RBAC dynamic matrix gating (PR7.1)", () => {
  it("hides the Contabilidad accordion when the matrix denies journal.read", () => {
    // Matrix-denied caller: role has no journal.read permission
    const deniedSnapshot = {
      orgId: "test-org-id",
      role: "auxiliar",
      permissionsRead: ["farms", "documents", "agent"],
      permissionsWrite: ["farms"],
      canPost: [],
    };

    render(
      <RolesMatrixProvider snapshot={deniedSnapshot}>
        <AppSidebar onOpenAgentChat={vi.fn()} />
      </RolesMatrixProvider>,
    );

    expect(
      screen.queryByRole("button", { name: /Contabilidad/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Miembros/i }),
    ).not.toBeInTheDocument();
  });

  it("shows only allowed top-level items when matrix restricts the role", () => {
    // auxiliar-like custom role: only farms + documents + agent
    const partialSnapshot = {
      orgId: "test-org-id",
      role: "custom",
      permissionsRead: ["farms", "documents", "agent"],
      permissionsWrite: [],
      canPost: [],
    };

    render(
      <RolesMatrixProvider snapshot={partialSnapshot}>
        <AppSidebar onOpenAgentChat={vi.fn()} />
      </RolesMatrixProvider>,
    );

    expect(screen.getByRole("link", { name: /Granjas|Mis Granjas/i })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Contabilidad/i })).toBeNull();
  });

  it("renders nothing gated-by-role when snapshot is null (loading)", () => {
    render(
      <RolesMatrixProvider snapshot={null}>
        <AppSidebar onOpenAgentChat={vi.fn()} />
      </RolesMatrixProvider>,
    );

    // All resource-gated items should be absent during loading (deny by default)
    expect(
      screen.queryByRole("button", { name: /Contabilidad/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Miembros/i }),
    ).not.toBeInTheDocument();
  });
});

describe("AppSidebar — Informes entry TRIANGULATION", () => {
  it('renders "Informes" even when other top-level entries are present', () => {
    renderSidebar();
    const labels = getContabilidadChildLabels();

    expect(labels).toContain("Informes");
    expect(labels).toContain("Plan de Cuentas");
    expect(labels).toContain("Libro Diario");
  });

  it("renders exactly one occurrence of Informes (idempotency)", () => {
    renderSidebar();
    const labels = getContabilidadChildLabels();

    const count = labels.filter((l) => l === "Informes").length;
    expect(count).toBe(1);
  });
});
