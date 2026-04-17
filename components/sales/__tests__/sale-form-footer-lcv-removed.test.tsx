/**
 * T3.3 RED → T3.4 GREEN
 * REQ-A.1 (removal): footer action bar MUST NOT contain the old
 * "Registrar Libro de Ventas" / "Editar Libro de Ventas IVA" button.
 *
 * After PR3 the LCV action lives in the header LcvIndicator (T3.2).
 * The footer button is dead UI and must be removed.
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
  name: "Enero 2026",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-31"),
  status: "OPEN" as const,
  organizationId: "org-1",
  year: 2026,
  createdById: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const INCOME_ACCOUNT = { id: "acc-1", code: "4.1.1", name: "Ventas" };

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

const BASE_SALE = {
  id: "sale-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "POSTED" as string,
  totalAmount: 113,
  description: "Venta de prueba",
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
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" as string },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [
    {
      id: "det-1",
      saleId: "sale-1",
      description: "Servicio",
      incomeAccountId: "acc-1",
      lineAmount: 113,
      quantity: 1,
      unitPrice: 113,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  receivable: null,
};

function renderForm(salePatch: Partial<typeof BASE_SALE> = {}) {
  const sale = { ...BASE_SALE, ...salePatch };
  return render(
    <SaleForm
      orgSlug="test-org"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      incomeAccounts={[INCOME_ACCOUNT]}
      sale={sale as any}
      mode="edit"
    />,
  );
}

// ── Tests ──

describe("SaleForm — footer LCV button removed (T3.3/T3.4 REQ-A.1)", () => {
  it("R.1 — DRAFT sale → footer does NOT contain old 'Registrar Libro de Ventas' button", () => {
    renderForm({ status: "DRAFT", ivaSalesBook: null });
    // Footer button must NOT exist — LCV action is now in the header indicator
    expect(
      screen.queryByRole("button", { name: /registrar libro de ventas/i }),
    ).not.toBeInTheDocument();
  });

  it("R.2 — POSTED sale, no ivaSalesBook → footer does NOT contain old 'Registrar Libro de Ventas'", () => {
    renderForm({ status: "POSTED", ivaSalesBook: null });
    expect(
      screen.queryByRole("button", { name: /registrar libro de ventas/i }),
    ).not.toBeInTheDocument();
  });

  it("R.3 — POSTED sale with ivaSalesBook → footer does NOT contain 'Editar Libro de Ventas IVA'", () => {
    renderForm({
      status: "POSTED",
      ivaSalesBook: { id: "iva-1" } as any,
    });
    expect(
      screen.queryByRole("button", { name: /editar libro de ventas iva/i }),
    ).not.toBeInTheDocument();
  });

  it("R.4 — OPEN period, POSTED sale → footer does NOT contain old LCV button of any kind", () => {
    renderForm({ status: "POSTED", period: { id: "period-1", name: "Enero 2026", status: "OPEN" } });
    // Neither variant of the old footer button text should appear
    expect(
      screen.queryByRole("button", { name: /registrar libro de ventas/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /editar libro de ventas iva/i }),
    ).not.toBeInTheDocument();
  });
});
