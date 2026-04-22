/**
 * T4.2 RED → T4.8 GREEN
 *
 * REQ-B.2 — sale-form.tsx display sites use formatDateBO():
 *   - line 545: read-only Fecha in the header dl (VOIDED/LOCKED)
 *   - line 888: cobro payment.date in the Resumen de Cobros (POSTED/LOCKED)
 *
 * Both must render "DD/MM/YYYY" (e.g. "17/04/2026") instead of the
 * old "17/4/2026" bare toLocaleDateString output.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import SaleForm from "../sale-form";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "admin" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/iva-books/iva-book-sale-modal", () => ({
  IvaBookSaleModal: () => null,
}));

// ── Fixtures ──

const BASE_PERIOD = {
  id: "period-1",
  name: "Abril 2026",
  startDate: new Date("2026-04-01"),
  endDate: new Date("2026-04-30"),
  status: "OPEN" as const,
  organizationId: "org-1",
  year: 2026,
  createdById: "user-1",
  month: 4,
  closedAt: null,
  closedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BASE_CONTACT = {
  id: "contact-1",
  name: "Cliente SA",
  type: "CLIENTE" as const,
  nit: "12345",
  paymentTermsDays: 30,
  organizationId: "org-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  email: null,
  phone: null,
  address: null,
  creditLimit: null,
  isActive: true,
};

const INCOME_ACCOUNT = { id: "acc-1", code: "4.1.1", name: "Ventas" };

// VOIDED sale for read-only header view (line 545)
const VOIDED_SALE = {
  id: "sale-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-04-17T00:00:00.000Z"),
  status: "VOIDED",
  totalAmount: 500,
  description: "Venta anulada",
  referenceNumber: "REF-001",
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

// POSTED sale with receivable for cobro date (line 888)
const POSTED_SALE_WITH_RECEIVABLE = {
  id: "sale-2",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-04-17T12:00:00.000Z"),
  status: "POSTED",
  totalAmount: 1000,
  description: "Venta cobrada",
  referenceNumber: null,
  notes: null,
  displayCode: "CI-002",
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  journalEntryId: "je-1",
  ivaSalesBook: null,
  contact: { id: "contact-1", name: "Cliente SA", type: "CLIENTE", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Abril 2026", status: "OPEN" },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [],
  receivable: {
    id: "rec-1",
    amount: 1000,
    paid: 500,
    balance: 500,
    status: "OPEN",
    allocations: [
      {
        id: "alloc-1",
        paymentId: "pay-1",
        amount: 500,
        payment: {
          id: "pay-1",
          date: "2026-04-05T00:00:00.000Z",
          description: "Pago parcial",
        },
      },
    ],
  },
};

// ── Render helpers ──

function renderVoidedSale() {
  return render(
    <SaleForm
      orgSlug="test-org"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      incomeAccounts={[INCOME_ACCOUNT]}
      sale={VOIDED_SALE as any}
      mode="edit"
    />,
  );
}

function renderPostedWithReceivable() {
  return render(
    <SaleForm
      orgSlug="test-org"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      incomeAccounts={[INCOME_ACCOUNT]}
      sale={POSTED_SALE_WITH_RECEIVABLE as any}
      mode="edit"
    />,
  );
}

// ── Tests ──

describe("SaleForm — display date format (REQ-B.2)", () => {
  it("B.2.1 — read-only Fecha header (VOIDED) renders DD/MM/YYYY", () => {
    renderVoidedSale();
    // The read-only dl shows the sale date formatted
    expect(screen.getByText("17/04/2026")).toBeInTheDocument();
  });

  it("B.2.2 — read-only Fecha does NOT render old bare locale format", () => {
    renderVoidedSale();
    // Old format: "17/4/2026" (no zero-pad from bare toLocaleDateString)
    expect(screen.queryByText("17/4/2026")).not.toBeInTheDocument();
  });

  it("B.2.3 — cobro payment.date in Resumen de Cobros renders DD/MM/YYYY", () => {
    renderPostedWithReceivable();
    // The payment date "2026-04-05T00:00:00.000Z" → "05/04/2026"
    expect(screen.getByText(/Cobro el\s+05\/04\/2026/)).toBeInTheDocument();
  });

  it("B.2.4 — cobro payment.date does NOT render old locale format", () => {
    renderPostedWithReceivable();
    // Old format: "5/4/2026" or similar without zero-pad
    expect(screen.queryByText(/Cobro el\s+5\/4\/2026/)).not.toBeInTheDocument();
  });
});
