/**
 * T3.1 RED → T3.2 GREEN
 * REQ-A.1: sale-form header row 2 must render <LcvIndicator> alongside Cliente and Total.
 *
 * Grid: sm:grid-cols-3 (was sm:grid-cols-2).
 * State derivation:
 *   - DRAFT / no sale.id  → S1
 *   - saved, no ivaSalesBook → S2
 *   - saved, ivaSalesBook present → S3
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

function renderForm(salePatch: Partial<typeof BASE_SALE> = {}, mode: "new" | "edit" = "edit") {
  const sale = mode === "new" ? undefined : { ...BASE_SALE, ...salePatch };
  return render(
    <SaleForm
      orgSlug="test-org"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      incomeAccounts={[INCOME_ACCOUNT]}
      sale={sale as any}
      mode={mode}
    />,
  );
}

// ── Tests ──

describe("SaleForm — LCV indicator in header row 2 (T3.1/T3.2 REQ-A.1)", () => {
  it("A.1.1 — saved sale without ivaSalesBook → LcvIndicator renders (S2)", () => {
    renderForm({ status: "POSTED", ivaSalesBook: null });
    // The LcvIndicator S2 renders a button with "Registrar en LCV"
    const indicator = screen.getByRole("button", { name: /registrar en lcv/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S2");
  });

  it("A.1.2 — saved sale with ivaSalesBook → LcvIndicator renders (S3)", () => {
    renderForm({
      status: "POSTED",
      ivaSalesBook: {
        id: "iva-1",
        organizationId: "org-1",
        status: "ACTIVE" as any,
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
      } as any,
    });
    const indicator = screen.getByRole("button", { name: /registrado en lcv/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S3");
  });

  it("A.1.3 — DRAFT sale → LcvIndicator renders in S1 (disabled)", () => {
    renderForm({ status: "DRAFT", ivaSalesBook: null });
    const indicator = screen.getByRole("button", { name: /lcv no disponible/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S1");
    expect(indicator).toBeDisabled();
  });

  it("A.1.4 — header row 2 grid has sm:grid-cols-3", () => {
    const { container } = renderForm({ status: "POSTED", ivaSalesBook: null });
    // Row 2 is the div containing Cliente. It should now have sm:grid-cols-3.
    const row2 = container.querySelector(".sm\\:grid-cols-3");
    expect(row2).toBeInTheDocument();
  });

  it("A.1.5 — new sale (mode=new) → LcvIndicator renders S1", () => {
    renderForm({}, "new");
    const indicator = screen.getByRole("button", { name: /lcv no disponible/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S1");
  });
});
