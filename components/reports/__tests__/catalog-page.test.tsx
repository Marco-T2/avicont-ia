import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// Mock next/link — jsdom no tiene router de Next.js
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

import { CatalogPage } from "@/components/reports/catalog-page";
import { reportCategories, reportRegistry } from "@/features/reports";

// ── helpers ────────────────────────────────────────────────────────────────
const availableEntries = reportRegistry.filter((e) => e.status === "available");
const orgSlug = "test-org";

afterEach(() => {
  cleanup();
});

// ── Suite ──────────────────────────────────────────────────────────────────
describe("CatalogPage", () => {
  // 4.1-A: Renders all 9 category section headers
  it("renders all 9 category section headers in Spanish", () => {
    render(<CatalogPage orgSlug={orgSlug} entries={reportRegistry} />);

    for (const cat of reportCategories) {
      expect(
        screen.getByRole("heading", { name: cat.label })
      ).toBeTruthy();
    }
  });

  // 4.1-B: Category headers appear in sortOrder (order asc)
  it("renders category headers in ascending order", () => {
    render(<CatalogPage orgSlug={orgSlug} entries={reportRegistry} />);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);

    const expectedOrder = [...reportCategories]
      .sort((a, b) => a.order - b.order)
      .map((c) => c.label);

    expect(headings).toEqual(expectedOrder);
  });

  // 4.1-C: Available entries render as clickable <a> with orgSlug-prefixed href
  it("renders available report entries as clickable links with correct href", () => {
    render(<CatalogPage orgSlug={orgSlug} entries={reportRegistry} />);

    for (const entry of availableEntries) {
      const link = screen.getByRole("link", { name: entry.title });
      expect(link).toBeTruthy();
      expect(link.getAttribute("href")).toBe(`/${orgSlug}${entry.route}`);
    }
  });

  // 4.1-D: Available count matches registry
  it(`renders exactly ${availableEntries.length} anchor links (available entries only)`, () => {
    render(<CatalogPage orgSlug={orgSlug} entries={reportRegistry} />);

    // Only <a> tags have href — planned cards are div[role=link] with no href
    const anchorLinks = screen
      .getAllByRole("link")
      .filter((el) => el.tagName.toLowerCase() === "a");
    expect(anchorLinks).toHaveLength(availableEntries.length);
  });

  // 4.1-G: Available entries show "Disponible" badge
  it("renders 'Disponible' badge on each available entry", () => {
    render(<CatalogPage orgSlug={orgSlug} entries={reportRegistry} />);

    const disponibleBadges = screen.getAllByText("Disponible");
    expect(disponibleBadges).toHaveLength(availableEntries.length);
  });

  // C0-RED [RED]: CatalogPage consumes `entries` prop (pre-filtered by page route)
  // — when CxP excluded from entries, the exact CxP card title must NOT render.
  it("excludes the 'Cuentas por Pagar' card when entries[] omits it (RBAC filter at page route)", () => {
    // Build a registry WITHOUT cuentas-por-pagar, simulating page-route RBAC filter
    const filteredEntries = reportRegistry.filter(
      (e) => e.id !== "cuentas-por-pagar",
    );

    render(<CatalogPage orgSlug={orgSlug} entries={filteredEntries} />);

    // The exact CxP card title must NOT appear (note: "Antigüedad de
    // Cuentas por Pagar" is a separate planned entry — match exact text)
    expect(
      screen.queryByText((_, el) => el?.textContent?.trim() === "Cuentas por Pagar"),
    ).toBeNull();
  });

  it("includes the 'Cuentas por Cobrar' card when entries[] contains it (available report)", () => {
    render(<CatalogPage orgSlug={orgSlug} entries={reportRegistry} />);

    // The exact CxC card title must be present after registry adds it
    expect(
      screen.getByText((_, el) => el?.textContent?.trim() === "Cuentas por Cobrar"),
    ).toBeTruthy();
  });
});
