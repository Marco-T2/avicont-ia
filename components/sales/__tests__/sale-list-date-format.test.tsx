/**
 * T4.1 RED → T4.7 GREEN
 *
 * REQ-B.3 — sale-list.tsx date cell must use formatDateBO() and render
 * "DD/MM/YYYY" format instead of the old "17 ene. 2026" locale format.
 *
 * Key scenario: a UTC-midnight date "2026-04-17T00:00:00.000Z" stored for a
 * Bolivia record must display as "17/04/2026", not "16/04/2026" (off-by-one
 * via toLocaleDateString).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import SaleList from "../sale-list";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Fixtures ──

const SALE = {
  id: "sale-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-04-17T00:00:00.000Z"), // UTC-midnight — old code shows Apr 16 in Bolivia
  status: "POSTED",
  totalAmount: 500,
  description: "Venta test",
  referenceNumber: null,
  notes: null,
  displayCode: "CI-001",
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  journalEntryId: null,
  ivaSalesBook: null,
  contact: { id: "contact-1", name: "Cliente SA", type: "CLIENTE", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Abril 2026", status: "OPEN" },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [],
  receivable: null,
};

// ── Tests ──

describe("SaleList — date cell format (REQ-B.3)", () => {
  it("B.3.1 — date cell renders DD/MM/YYYY format", () => {
    render(<SaleList orgSlug="test-org" items={[SALE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    expect(screen.getByText("17/04/2026")).toBeInTheDocument();
  });

  it("B.3.2 — date cell does NOT render old locale short-month format", () => {
    render(<SaleList orgSlug="test-org" items={[SALE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    // Old format was "17 abr. 2026" or "17 abr 2026" — regex scoped to day+month pattern
    expect(screen.queryByText(/\d+\s+abr/i)).not.toBeInTheDocument();
  });

  it("B.3.3 — UTC-midnight date shows correct local day (17/04, not 16/04)", () => {
    render(<SaleList orgSlug="test-org" items={[SALE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    // formatDateBO slices ISO string directly — never converts to local Date
    expect(screen.getByText("17/04/2026")).toBeInTheDocument();
    expect(screen.queryByText("16/04/2026")).not.toBeInTheDocument();
  });
});
