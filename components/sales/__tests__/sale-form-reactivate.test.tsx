/**
 * RED → GREEN
 * sale-form — reactivate flow for VOIDED ivaSalesBook
 *
 * REQ: When sale.ivaSalesBook.status === 'VOIDED' and user clicks S2 "Registrar en LCV",
 * the ReactivateLcvConfirmDialog opens (NOT the IvaBookSaleModal).
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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
  month: 4,
  closedAt: null,
  closedBy: null,
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

const VOIDED_IVA_BOOK = {
  id: "iva-voided-1",
  organizationId: "org-1",
  status: "VOIDED" as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  fiscalPeriodId: "period-1",
  saleId: "sale-1",
  date: "2026-01-15",
  nit: "12345",
  razonSocial: "Cliente SA",
  nroFactura: 1,
  autorizacion: "123",
  importe: 113,
  importeExentoIva: 0,
  descuentosBonificaciones: 0,
  importeSujetoIva: 113,
  creditoFiscal: 13,
  codigoControl: null,
  estadoSIN: "V",
  tipoVenta: "C",
  iceIehd: 0,
  ipj: 0,
  tasas: 0,
  otrosNoSujetosIva: 0,
  exportaciones: 0,
  tasasCero: 0,
  subtotalVentas: 100,
  descuentoSujeto: 0,
  gitAmount: 0,
  itAmount: 0,
};

const BASE_SALE_VOIDED_IVA = {
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
  ivaSalesBook: VOIDED_IVA_BOOK,
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

function renderFormWithVoidedIva() {
  return render(
    <SaleForm
      orgSlug="test-org"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      incomeAccounts={[INCOME_ACCOUNT]}
      sale={BASE_SALE_VOIDED_IVA as any}
      mode="edit"
    />,
  );
}

// ── Tests ──

describe("SaleForm — reactivate flow for VOIDED ivaSalesBook", () => {
  it("VOIDED ivaSalesBook + S2 click → ReactivateLcvConfirmDialog opens (NOT IvaModal)", () => {
    renderFormWithVoidedIva();

    // S2 button is visible
    const s2Button = screen.getByRole("button", { name: /registrar en lcv/i });
    expect(s2Button).toBeInTheDocument();
    expect(s2Button).toHaveAttribute("data-lcv-state", "S2");

    // The reactivate dialog title should NOT be visible yet
    expect(
      screen.queryByText("Reactivar registro en el Libro de Ventas"),
    ).not.toBeInTheDocument();

    // Click S2 button
    fireEvent.pointerDown(s2Button, { button: 0 });
    fireEvent.click(s2Button);

    // Now the reactivate dialog should be open
    expect(
      screen.getByText("Reactivar registro en el Libro de Ventas"),
    ).toBeInTheDocument();
  });

  it("VOIDED ivaSalesBook + S2 click → IvaBookSaleModal does NOT open", () => {
    renderFormWithVoidedIva();

    const s2Button = screen.getByRole("button", { name: /registrar en lcv/i });
    fireEvent.pointerDown(s2Button, { button: 0 });
    fireEvent.click(s2Button);

    // The IvaBookSaleModal is mocked as null — verify reactivate dialog opened instead
    // by confirming reactivate dialog title is present
    expect(
      screen.getByText("Reactivar registro en el Libro de Ventas"),
    ).toBeInTheDocument();
  });
});
