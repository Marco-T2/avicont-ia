/**
 * Tests RTL: gate del botón "Registrar Libro de Ventas" por fiscalPeriod.status.
 *
 * SPEC-5: el botón debe estar habilitado cuando period.status === "OPEN"
 * y deshabilitado (con mensaje de tooltip) cuando === "CLOSED".
 * NO debe depender de sale.status (DRAFT o POSTED → botón habilitado si OPEN).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import SaleForm from "../sale-form";

afterEach(() => cleanup());

// ── Mocks de dependencias externas ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "admin" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// El modal IVA es un componente pesado; lo silenciamos para tests de gate
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

const BASE_SALE = {
  id: "sale-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "DRAFT" as const,
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
  contact: { id: "contact-1", name: "Cliente SA", type: "CLIENT", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" as const },
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
      contacts={[{ id: "contact-1", name: "Cliente SA", type: "CLIENT", nit: "12345", paymentTermsDays: 30, organizationId: "org-1", createdAt: new Date(), updatedAt: new Date(), notes: null, email: null, phone: null, address: null, createdById: "user-1", updatedById: null }]}
      periods={[BASE_PERIOD]}
      incomeAccounts={[INCOME_ACCOUNT]}
      sale={sale as any}
      mode="edit"
    />,
  );
}

// ── Tests ──

describe("SaleForm — IVA button fiscal period gate (SPEC-5)", () => {
  it("5.1 — OPEN period + DRAFT sale → button is enabled", () => {
    renderForm({ status: "DRAFT", period: { id: "period-1", name: "Enero 2026", status: "OPEN" } });
    const btn = screen.getByRole("button", { name: /registrar libro de ventas/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("5.2 — OPEN period + POSTED sale → button is STILL enabled (not gated by DRAFT)", () => {
    renderForm({ status: "POSTED", period: { id: "period-1", name: "Enero 2026", status: "OPEN" } });
    const btn = screen.getByRole("button", { name: /registrar libro de ventas/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("5.3 — CLOSED period → button is disabled with tooltip message", () => {
    renderForm({ status: "DRAFT", period: { id: "period-1", name: "Enero 2026", status: "CLOSED" } });
    const btn = screen.getByRole("button", { name: /registrar libro de ventas/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    // El título/aria-label debe contener el mensaje de período cerrado
    expect(btn).toHaveAttribute("title", "El período fiscal está cerrado.");
  });

  it("5.3b — CLOSED period + POSTED sale → button is also disabled", () => {
    renderForm({ status: "POSTED", period: { id: "period-1", name: "Enero 2026", status: "CLOSED" } });
    const btn = screen.getByRole("button", { name: /registrar libro de ventas/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "El período fiscal está cerrado.");
  });
});
