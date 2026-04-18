/**
 * PR3.1 [RED] — REQ-MS.9: CrossModuleNav per-resource filtering
 *
 * The CrossModuleNav renders three fixed entries — Agente IA, Miembros,
 * Documentos — each independently gated by its own `Resource`:
 *   - Agente IA  → resource "agent"
 *   - Miembros   → resource "members"
 *   - Documentos → resource "documents"
 *
 * Agente IA is an action button (opens the chat via onOpenAgentChat),
 * not a navigation link. Miembros and Documentos are links.
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
  permissionsRead: ["members", "documents", "agent", "farms"],
  permissionsWrite: [],
  canPost: [],
};

/** No members access */
const NO_MEMBERS: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "contador",
  permissionsRead: ["documents", "agent", "farms"],
  permissionsWrite: [],
  canPost: [],
};

/** No agent access */
const NO_AGENT: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "auxiliar",
  permissionsRead: ["members", "documents", "farms"],
  permissionsWrite: [],
  canPost: [],
};

/** No documents access */
const NO_DOCS: ClientMatrixSnapshot = {
  orgId: "org-1",
  role: "auxiliar",
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
// PR3.1 — REQ-MS.9: Per-resource filtering
// ---------------------------------------------------------------------------

describe("CrossModuleNav — per-resource filtering (REQ-MS.9)", () => {
  it("renders Agente IA, Miembros, and Documentos when all cross-module resources are accessible", () => {
    renderNav(ALL);

    expect(screen.getByRole("button", { name: /Agente IA/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Miembros/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Documentos/i })).toBeTruthy();
  });

  it("hides Miembros when members access is denied", () => {
    renderNav(NO_MEMBERS);

    expect(screen.queryByRole("link", { name: /Miembros/i })).toBeNull();
    // sanity: Agente IA and Documentos still present
    expect(screen.getByRole("button", { name: /Agente IA/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Documentos/i })).toBeTruthy();
  });

  it("hides Agente IA when agent access is denied", () => {
    renderNav(NO_AGENT);

    expect(screen.queryByRole("button", { name: /Agente IA/i })).toBeNull();
    // sanity: Miembros and Documentos still present
    expect(screen.getByRole("link", { name: /Miembros/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Documentos/i })).toBeTruthy();
  });

  it("hides Documentos when documents access is denied", () => {
    renderNav(NO_DOCS);

    expect(screen.queryByRole("link", { name: /Documentos/i })).toBeNull();
    // sanity: Agente IA and Miembros still present
    expect(screen.getByRole("button", { name: /Agente IA/i })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Miembros/i })).toBeTruthy();
  });

  it("renders nothing gated-by-resource when all three cross-module resources are denied", () => {
    renderNav(NONE);

    expect(screen.queryByRole("button", { name: /Agente IA/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Miembros/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Documentos/i })).toBeNull();
  });

  it("denies all three when matrix snapshot is null (loading state)", () => {
    renderNav(null);

    expect(screen.queryByRole("button", { name: /Agente IA/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Miembros/i })).toBeNull();
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
// PR3.1 — Behavior: Miembros and Documentos are links to org-scoped routes
// ---------------------------------------------------------------------------

describe("CrossModuleNav — hrefs resolved with orgSlug", () => {
  it("Miembros link points to /{orgSlug}/members", () => {
    renderNav(ALL);
    const link = screen.getByRole("link", { name: /Miembros/i });
    expect(link.getAttribute("href")).toBe("/test-org/members");
  });

  it("Documentos link points to /{orgSlug}/documents", () => {
    renderNav(ALL);
    const link = screen.getByRole("link", { name: /Documentos/i });
    expect(link.getAttribute("href")).toBe("/test-org/documents");
  });
});
