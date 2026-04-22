/**
 * REQ-1a — RED: PeriodList "Cerrar" row action renders a navigation link, not a modal trigger.
 *
 * RED expected failure mode (Rule 1): expected <a> element but got <button>
 * because current period-list.tsx:101-110 renders a <Button onClick={() => setPeriodToClose(period)}>
 * that is not an <a>. No modal/dialog opens when clicking a link.
 *
 * GREEN lands with T-F08-GREEN which replaces the button with
 * <Button asChild><Link href=...>Cerrar</Link></Button>.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock Link so we can assert on the rendered anchor
vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock child dialogs to avoid their setup complexity
vi.mock("../period-create-dialog", () => ({
  default: vi.fn(() => null),
}));

// period-close-dialog may or may not exist at test time (it will be deleted in T-F08-GREEN)
// Use a safe mock that silently handles both cases
vi.mock("../period-close-dialog", () => ({
  default: vi.fn(() => null),
}));

import PeriodList from "../period-list";

const ORG_SLUG = "acme";

const OPEN_PERIOD = {
  id: "p-01",
  organizationId: "org-1",
  name: "Enero 2026",
  year: 2026,
  month: 1,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-31"),
  status: "OPEN" as const,
  closedAt: null,
  closedBy: null,
  createdById: "user-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("PeriodList — REQ-1a: row Cerrar action renders navigation link", () => {
  it("renders an <a> element with href containing /accounting/monthly-close?periodId=p-01", () => {
    // RED: current component renders <Button onClick> not <a>
    render(<PeriodList orgSlug={ORG_SLUG} periods={[OPEN_PERIOD]} />);

    // Should render a navigation link for the OPEN period
    const cerrarLink = screen.getByRole("link", { name: /cerrar/i });

    expect(cerrarLink).toBeInTheDocument();
    expect(cerrarLink.tagName).toBe("A");
    expect(cerrarLink).toHaveAttribute(
      "href",
      `/${ORG_SLUG}/accounting/monthly-close?periodId=p-01`,
    );
  });

  it("does not render a dialog/modal when the Cerrar action is present", () => {
    render(<PeriodList orgSlug={ORG_SLUG} periods={[OPEN_PERIOD]} />);

    // The close dialog should NOT be in the DOM (it was retired by F-08)
    const dialog = screen.queryByRole("dialog");
    expect(dialog).not.toBeInTheDocument();
  });
});
