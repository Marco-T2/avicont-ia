/**
 * PR3.1 [RED] — REQ-MS.9: CrossModuleNav per-resource filtering
 *
 * The CrossModuleNav renders fixed entries — Agente IA and Documentos —
 * each independently gated by its own `Resource`:
 *   - Agente IA  → resource "agent"
 *   - Documentos → resource "documents"
 *
 * Agente IA is an action button (opens the chat via onOpenAgentChat),
 * not a navigation link. Documentos is a link.
 *
 * C2 sidebar-reorg-settings-hub: Miembros and Auditoría removed from
 * cross-module nav. Miembros is already a Settings hub card; Auditoría
 * becomes a Settings hub card in C3.
 *
 * Environment: jsdom (.test.tsx — components project)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import type { ClientMatrixSnapshot } from "@/components/common/roles-matrix-provider";

// ---------------------------------------------------------------------------
// Mocks — top-level, before any import of production modules
// ---------------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgSlug: "test-org" }),
  usePathname: () => "/test-org/farms",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// Sidebar provider — not collapsed (so labels are visible)
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

import { CrossModuleNav } from "../cross-module-nav";

// ---------------------------------------------------------------------------
// Snapshot fixtures
// ---------------------------------------------------------------------------

/** Owner-like: all cross-module resources accessible */
const ALL: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "owner",
  permissionsRead: ["members", "documents", "agent", "audit", "farms"],
  permissionsWrite: [],
  canPost: [],
};

/** No agent access */
const NO_AGENT: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "cobrador",
  permissionsRead: ["members", "documents", "farms"],
  permissionsWrite: [],
  canPost: [],
};

/** No documents access */
const NO_DOCS: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "cobrador",
  permissionsRead: ["members", "agent", "farms"],
  permissionsWrite: [],
  canPost: [],
};

/** No cross-module resources at all */
const NONE: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "member",
  permissionsRead: ["farms"],
  permissionsWrite: [],
  canPost: [],
};

/** Members + audit only — both REMOVED in C2, so the nav renders nothing */
const MEMBERS_AUDIT_ONLY: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "admin",
  permissionsRead: ["members", "audit", "farms"],
  permissionsWrite: [],
  canPost: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderNav(
  snapshot: ClientMatrixSnapshot | null,
  onOpenAgentChat: () => void = vi.fn()
) {
  return render(
    <RolesMatrixProvider snapshot={snapshot}>
      <CrossModuleNav orgSlug="test-org" onOpenAgentChat={onOpenAgentChat} />
    </RolesMatrixProvider>
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

afterEach(cleanup);

// ---------------------------------------------------------------------------
// C2 sidebar-reorg-settings-hub — trimmed nav
// ---------------------------------------------------------------------------

describe("CrossModuleNav — C2 trim (Miembros + Auditoría removed)", () => {
  it("renders ONLY Agente IA + Documentos when all cross-module resources are accessible", () => {
    renderNav(ALL);

    expect(screen.getByRole("button", { name: /Agente IA/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Documentos/i })).toBeTruthy();

    // Removed entries — NEVER rendered, regardless of permissions
    expect(screen.queryByRole("link", { name: /Miembros/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Auditoría/i })).toBeNull();
  });

  it("renders nothing when a user has only members + audit read (both moved to /settings)", () => {
    renderNav(MEMBERS_AUDIT_ONLY);

    // Members and audit access do NOT unlock cross-module nav anymore
    expect(screen.queryByRole("link", { name: /Miembros/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Auditoría/i })).toBeNull();
    // No agent, no documents → entire nav renders null (no <nav>)
    expect(screen.queryByRole("button", { name: /Agente IA/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Documentos/i })).toBeNull();
  });

  it("hides Agente IA when agent access is denied", () => {
    renderNav(NO_AGENT);

    expect(screen.queryByRole("button", { name: /Agente IA/i })).toBeNull();
    // sanity: Documentos still present
    expect(screen.getByRole("link", { name: /Documentos/i })).toBeTruthy();
  });

  it("hides Documentos when documents access is denied", () => {
    renderNav(NO_DOCS);

    expect(screen.queryByRole("link", { name: /Documentos/i })).toBeNull();
    // sanity: Agente IA still present
    expect(screen.getByRole("button", { name: /Agente IA/i })).toBeTruthy();
  });

  it("renders nothing when no cross-module resources are accessible", () => {
    renderNav(NONE);

    expect(screen.queryByRole("button", { name: /Agente IA/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Documentos/i })).toBeNull();
  });

  it("denies all when matrix snapshot is null (loading state)", () => {
    renderNav(null);

    expect(screen.queryByRole("button", { name: /Agente IA/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Documentos/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PR3.1 — Behavior: Agente IA invokes callback (not navigation)
// ---------------------------------------------------------------------------

describe("CrossModuleNav — Agente IA invokes onOpenAgentChat (preserves pre-PR3 semantics)", () => {
  it("calls onOpenAgentChat when Agente IA button is clicked", () => {
    const onOpen = vi.fn();
    renderNav(ALL, onOpen);

    const btn = screen.getByRole("button", { name: /Agente IA/i });
    fireEvent.click(btn);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// PR3.1 — Behavior: Documentos link to org-scoped route
// ---------------------------------------------------------------------------

describe("CrossModuleNav — hrefs resolved with orgSlug", () => {
  it("Documentos link points to /{orgSlug}/documents", () => {
    renderNav(ALL);
    const link = screen.getByRole("link", { name: /Documentos/i });
    expect(link.getAttribute("href")).toBe("/test-org/documents");
  });
});
