/**
 * PR4.3 [RED] — Tests for RoleSidebarPreview — 3 canonical fixtures
 * REQ-RM.9, REQ-RM.10, REQ-RM.11, REQ-RM.12, REQ-RM.13, REQ-RM.14, REQ-RM.15
 *
 * All 8 tests must FAIL with "Cannot find module '@/components/settings/role-sidebar-preview'"
 * until PR4.4 [GREEN] creates the component.
 *
 * Environment: jsdom (.test.tsx — React component)
 *
 * Three canonical role fixtures:
 *   Admin-like:    readSet = all 12 resources → all modules + cross-module strip
 *   Chofer-like:   readSet = {dispatches, farms} → Contabilidad (Despachos only) + Granjas
 *   Viewer-only:   readSet = {} → empty-state text, no modules
 *
 * Plus separator-drop edge case, cross-module visibility, and responsive layout.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, it, expect } from "vitest";

import type { Resource } from "@/features/permissions";
import { RoleSidebarPreview } from "@/components/settings/role-sidebar-preview";

afterEach(cleanup);

// ─── Typed Set helpers ───────────────────────────────────────────────────────

function rs(...resources: Resource[]): Set<Resource> {
  return new Set<Resource>(resources);
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ALL_RESOURCES: Resource[] = [
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
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("<RoleSidebarPreview />", () => {
  // (a) Admin-like — all reads → all modules visible, all cross-module links shown
  it("(a) admin (all reads) → Contabilidad + Granjas modules + Organización strip visible", () => {
    render(
      <RoleSidebarPreview
        readSet={rs(...ALL_RESOURCES)}
        writeSet={rs(...ALL_RESOURCES)}
      />,
    );

    // Module sections visible (dual-mount → multiple elements expected)
    expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Granjas").length).toBeGreaterThan(0);

    // Nav items inside Contabilidad module (rendered in both desktop + mobile panes)
    expect(screen.getAllByText("Ventas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Libro Diario").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mis Granjas").length).toBeGreaterThan(0);

    // Cross-module / Organización strip
    expect(screen.getAllByText("Agente IA").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Miembros").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Documentos").length).toBeGreaterThan(0);
  });

  // (b) Chofer-like — readSet={sales, farms} → Contabilidad shows Ventas
  // (gated by 'sales'); Granjas present; no Organización strip items.
  // sidebar-reorg-settings-hub C1: Cuentas por Cobrar removed from sidebar
  // (moved to /informes catalog as an entry); only Ventas remains gated by sales.
  it("(b) chofer (sales+farms) → Contabilidad with Ventas + Granjas; no Org strip", () => {
    render(
      <RoleSidebarPreview
        readSet={rs("sales", "farms")}
        writeSet={rs()}
      />,
    );

    // Contabilidad module section header visible (dual-mount → multiple)
    expect(screen.getAllByText("Contabilidad").length).toBeGreaterThan(0);
    // Ventas gated by 'sales' visible (dual-mount → multiple)
    expect(screen.getAllByText("Ventas").length).toBeGreaterThan(0);
    // C1 trim: Cuentas por Cobrar no longer a sidebar entry
    expect(screen.queryByText(/Cuentas por Cobrar/i)).not.toBeInTheDocument();
    // These items require resources the chofer does NOT have
    expect(screen.queryByText("Libro Diario")).not.toBeInTheDocument();
    expect(screen.queryByText("Compras")).not.toBeInTheDocument();
    expect(screen.queryByText("Cobros y Pagos")).not.toBeInTheDocument();

    // Granjas visible (dual-mount → multiple)
    expect(screen.getAllByText("Granjas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mis Granjas").length).toBeGreaterThan(0);

    // No Organización strip items (sales/farms are not agent/documents)
    expect(screen.queryByText("Agente IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Miembros")).not.toBeInTheDocument();
    expect(screen.queryByText("Documentos")).not.toBeInTheDocument();
  });

  // (b-variant) REQ-RNM.3 — dispatches-only readSet has zero nav items
  // (dispatches is an API-only resource after the swap; no registry nav item gates on it)
  it("(b-variant) dispatches-only readSet → no Ventas in preview (no nav items gate on dispatches)", () => {
    render(
      <RoleSidebarPreview readSet={rs("dispatches")} writeSet={rs()} />,
    );

    // No nav item references dispatches — Ventas should NOT appear
    expect(screen.queryAllByText(/Ventas/i)).toHaveLength(0);
    // And no Cuentas por Cobrar (gated by 'sales', not present)
    expect(screen.queryAllByText(/Cuentas por Cobrar/i)).toHaveLength(0);
  });

  // (c) Viewer-only — empty sets → no modules, empty-state copy shown
  it("(c) viewer-only (empty sets) → empty-state text, no module sections", () => {
    render(<RoleSidebarPreview readSet={rs()} writeSet={rs()} />);

    // Empty-state message (Rioplatense voseo copy — dual-mount renders it twice)
    expect(screen.getAllByText(/ningún módulo/i).length).toBeGreaterThan(0);

    // No module nav items
    expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
    expect(screen.queryByText("Mis Granjas")).not.toBeInTheDocument();
    expect(screen.queryByText("Agente IA")).not.toBeInTheDocument();
  });

  // (d) sidebar-reorg-settings-hub C1: Plan de Cuentas no longer in sidebar
  // (moved to /settings as a card). accounting-config is still in the
  // Contabilidad module's resources[] array (used to determine visibility of
  // the Contabilidad module header), but it has NO matching navItem now —
  // so the Contabilidad section header does NOT render either (all navItems
  // require resources the user lacks; dropOrphanSeparators + empty-nav rule
  // hide the whole module).
  it("(d) readSet={accounting-config} only → Contabilidad nav items hidden; no PdC sidebar entry", () => {
    render(
      <RoleSidebarPreview
        readSet={rs("accounting-config")}
        writeSet={rs()}
      />,
    );

    // C1 trim: Plan de Cuentas no longer rendered as a sidebar entry
    expect(screen.queryByText("Plan de Cuentas")).not.toBeInTheDocument();
    // No separators in the trimmed Contabilidad nav
    expect(screen.queryByText("Operaciones")).not.toBeInTheDocument();
    // Other resource-gated items hidden too
    expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
    expect(screen.queryByText("Libro Diario")).not.toBeInTheDocument();
  });

  // (e) readSet={farms} only → only Granjas in module switcher area, Contabilidad absent
  it("(e) readSet={farms} only → only Granjas visible, Contabilidad absent", () => {
    render(
      <RoleSidebarPreview readSet={rs("farms")} writeSet={rs()} />,
    );

    // Granjas present (dual-mount)
    expect(screen.getAllByText("Granjas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mis Granjas").length).toBeGreaterThan(0);

    // Contabilidad module entirely absent (no readable resources in it)
    // We check for the Contabilidad MODULE section not rendering its nav items
    expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
    expect(screen.queryByText("Libro Diario")).not.toBeInTheDocument();
  });

  // (f) readSet={members} only → Organización strip shows only Miembros
  it("(f) readSet={members} only → Organización strip shows Miembros only", () => {
    render(
      <RoleSidebarPreview readSet={rs("members")} writeSet={rs()} />,
    );

    // Miembros visible in cross-module strip (dual-mount)
    expect(screen.getAllByText("Miembros").length).toBeGreaterThan(0);
    // Other cross-module items absent
    expect(screen.queryByText("Agente IA")).not.toBeInTheDocument();
    expect(screen.queryByText("Documentos")).not.toBeInTheDocument();
    // No module nav items (members is not in any module)
    expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
    expect(screen.queryByText("Mis Granjas")).not.toBeInTheDocument();
  });

  // (g) Desktop layout: always-visible pane NOT inside <details> — the sm:block pane
  it("(g) desktop pane: always-visible wrapper does NOT use a <details> element", () => {
    const { container } = render(
      <RoleSidebarPreview readSet={rs(...ALL_RESOURCES)} writeSet={rs()} />,
    );

    // The desktop pane (hidden sm:block or similar) should NOT be a <details>
    // We look for an element that has a class containing "sm:block" (the desktop pane)
    // and confirm it's not a <details>
    const desktopPane = container.querySelector("[data-testid='preview-desktop']");
    expect(desktopPane).not.toBeNull();
    expect(desktopPane!.tagName.toLowerCase()).not.toBe("details");
  });

  // (h) Mobile: a <details> element wraps a duplicate preview mount (sm:hidden)
  it("(h) mobile: a <details> element with <summary> wraps the mobile preview", () => {
    const { container } = render(
      <RoleSidebarPreview readSet={rs(...ALL_RESOURCES)} writeSet={rs()} />,
    );

    // There should be a <details> element (mobile collapsible)
    const detailsEl = container.querySelector("details[data-testid='preview-mobile']");
    expect(detailsEl).not.toBeNull();

    // It should contain a <summary>
    const summaryEl = detailsEl!.querySelector("summary");
    expect(summaryEl).not.toBeNull();
    expect(summaryEl!.textContent).toMatch(/previsualización/i);
  });
});

// ─── PR4.5 [RED] — Reactive update tests (REQ-RM.10) ─────────────────────────
// These tests extend the test file to verify pure-prop reactivity.
// They rely on React re-render via the `rerender` utility from RTL.

import { render as renderWithRerender } from "@testing-library/react";

describe("<RoleSidebarPreview /> — reactive updates (REQ-RM.10)", () => {
  // (a) journal present → re-render without journal → Libro Diario disappears
  it("(a) removing journal from readSet on re-render hides Libro Diario immediately", () => {
    const { rerender } = renderWithRerender(
      <RoleSidebarPreview readSet={rs("journal")} writeSet={rs()} />,
    );

    // Initially visible (dual-mount)
    expect(screen.getAllByText("Libro Diario").length).toBeGreaterThan(0);

    // Re-render with empty readSet
    rerender(<RoleSidebarPreview readSet={rs()} writeSet={rs()} />);

    // Libro Diario should be gone
    expect(screen.queryByText("Libro Diario")).not.toBeInTheDocument();
  });

  // (b) adding farms to readSet makes Granjas module appear on next render
  it("(b) adding farms to readSet on re-render shows Granjas module", () => {
    const { rerender } = renderWithRerender(
      <RoleSidebarPreview readSet={rs()} writeSet={rs()} />,
    );

    // Initially no modules (empty state)
    expect(screen.queryByText("Mis Granjas")).not.toBeInTheDocument();

    // Re-render with farms in readSet
    rerender(<RoleSidebarPreview readSet={rs("farms")} writeSet={rs()} />);

    // Granjas module now visible (dual-mount)
    expect(screen.getAllByText("Mis Granjas").length).toBeGreaterThan(0);
  });
});
