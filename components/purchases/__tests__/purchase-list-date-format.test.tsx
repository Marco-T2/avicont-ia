/**
 * T4.6 RED → T4.10 GREEN (partial: purchase-list)
 *
 * REQ-D.2 — purchase-list.tsx date cell must use formatDateBO()
 * and render "DD/MM/YYYY" format.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseList from "../purchase-list";

afterEach(() => cleanup());

// ── jsdom shims ──
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
window.Element.prototype.releasePointerCapture = vi.fn();
window.Element.prototype.setPointerCapture = vi.fn();

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Fixtures ──

const BASE_PURCHASE = {
  id: "purchase-1",
  organizationId: "org-1",
  purchaseType: "COMPRA_GENERAL",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-04-17T12:00:00.000Z"),
  status: "POSTED",
  totalAmount: 500,
  description: "Compra test",
  referenceNumber: null,
  notes: null,
  ruta: null,
  farmOrigin: null,
  chickenCount: null,
  shrinkagePct: null,
  totalGrossKg: null,
  totalNetKg: null,
  totalShrinkKg: null,
  totalShortageKg: null,
  totalRealNetKg: null,
  displayCode: "CG-001",
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  journalEntryId: null,
  ivaPurchaseBook: null,
  contact: { id: "contact-1", name: "Proveedor SA", type: "PROVEEDOR", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Abril 2026", status: "OPEN" },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [],
  payable: null,
};

// ── Tests ──

describe("PurchaseList — date cell format (REQ-D.2)", () => {
  it("D.2.5 — date cell renders DD/MM/YYYY format", () => {
    render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    expect(screen.getByText("17/04/2026")).toBeInTheDocument();
  });

  it("D.2.6 — date cell does NOT render old locale short-month format", () => {
    render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    // Old format was "17 abr. 2026" or "17 abr 2026" — regex scoped to day+month pattern
    expect(screen.queryByText(/\d+\s+abr/i)).not.toBeInTheDocument();
  });
});
