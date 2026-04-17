/**
 * T3.1 RED → T3.2 GREEN
 * REQ-A.1, REQ-A.2: purchase-form header row 2 must render <LcvIndicator>
 * alongside Proveedor and Total.
 *
 * Grid: sm:grid-cols-3 (was sm:grid-cols-2).
 * State derivation:
 *   - DRAFT / no purchase.id  → S1
 *   - saved, no ivaPurchaseBook → S2
 *   - saved, ivaPurchaseBook ACTIVE → S3
 *   - saved, ivaPurchaseBook VOIDED → S2 (treated as unregistered)
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseForm from "../purchase-form";

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

vi.mock("@/components/iva-books/iva-book-purchase-modal", () => ({
  IvaBookPurchaseModal: () => null,
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

const BASE_CONTACT = {
  id: "contact-1",
  name: "Proveedor SA",
  type: "PROVEEDOR" as const,
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

const BASE_PURCHASE = {
  id: "purchase-1",
  organizationId: "org-1",
  purchaseType: "COMPRA_GENERAL" as const,
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "POSTED" as string,
  totalAmount: 113,
  description: "Compra de prueba",
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
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" as string },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [
    {
      id: "det-1",
      purchaseId: "purchase-1",
      description: "Material",
      lineAmount: 113,
      quantity: 1,
      unitPrice: 113,
      order: 0,
      expenseAccountId: "acc-1",
      expenseAccountCode: "5.1.1",
      pricePerChicken: null,
      grossWeight: null,
      tare: null,
      netWeight: null,
      shrinkage: null,
      shortage: null,
      realNetWeight: null,
      productTypeId: null,
      detailNote: null,
      boxes: null,
      fecha: null,
      docRef: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  payable: null,
};

function renderForm(purchasePatch: Partial<typeof BASE_PURCHASE> = {}, mode: "new" | "edit" = "edit") {
  const purchase = mode === "new" ? undefined : { ...BASE_PURCHASE, ...purchasePatch };
  return render(
    <PurchaseForm
      orgSlug="test-org"
      purchaseType="COMPRA_GENERAL"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[]}
      purchase={purchase as any}
      mode={mode}
    />,
  );
}

// ── Tests ──

describe("PurchaseForm — LCV indicator in header row 2 (T3.1 REQ-A.1, A.2)", () => {
  it("A.1.1 — new purchase (mode=new) → LcvIndicator renders S1 (disabled)", () => {
    renderForm({}, "new");
    const indicator = screen.getByRole("button", { name: /lcv no disponible/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S1");
    expect(indicator).toBeDisabled();
  });

  it("A.1.2 — saved purchase without ivaPurchaseBook → LcvIndicator renders S2", () => {
    renderForm({ status: "POSTED", ivaPurchaseBook: null });
    const indicator = screen.getByRole("button", { name: /registrar en lcv/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S2");
  });

  it("A.1.3 — saved purchase with ivaPurchaseBook ACTIVE → LcvIndicator renders S3", () => {
    renderForm({
      status: "POSTED",
      ivaPurchaseBook: {
        id: "iva-1",
        organizationId: "org-1",
        status: "ACTIVE" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        fiscalPeriodId: "period-1",
        purchaseId: "purchase-1",
        date: "2026-01-15",
        nit: "12345",
        razonSocial: "Proveedor SA",
        nroFactura: 1,
        autorizacion: "123",
        importe: 113,
        importeExentoIva: 0,
        descuentosBonificaciones: 0,
        importeSujetoIva: 113,
        creditoFiscal: 13,
        itAmount: 0,
        codigoControl: null,
      } as any,
    });
    const indicator = screen.getByRole("button", { name: /registrado en lcv/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S3");
  });

  it("A.1.4 — DRAFT purchase → LcvIndicator renders S1 (disabled)", () => {
    renderForm({ status: "DRAFT", ivaPurchaseBook: null });
    const indicator = screen.getByRole("button", { name: /lcv no disponible/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S1");
    expect(indicator).toBeDisabled();
  });

  it("A.1.5 — ivaPurchaseBook VOIDED → LcvIndicator renders S2 (treated as unregistered)", () => {
    renderForm({
      status: "POSTED",
      ivaPurchaseBook: {
        id: "iva-1",
        organizationId: "org-1",
        status: "VOIDED" as any,
        createdAt: new Date(),
        updatedAt: new Date(),
        fiscalPeriodId: "period-1",
        purchaseId: "purchase-1",
        date: "2026-01-15",
        nit: "12345",
        razonSocial: "Proveedor SA",
        nroFactura: 1,
        autorizacion: "123",
        importe: 113,
        importeExentoIva: 0,
        descuentosBonificaciones: 0,
        importeSujetoIva: 113,
        creditoFiscal: 13,
        itAmount: 0,
        codigoControl: null,
      } as any,
    });
    const indicator = screen.getByRole("button", { name: /registrar en lcv/i });
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S2");
  });

  it("A.1.6 — header row 2 has sm:grid-cols-3", () => {
    const { container } = renderForm({ status: "POSTED", ivaPurchaseBook: null });
    const row2 = container.querySelector(".sm\\:grid-cols-3");
    expect(row2).toBeInTheDocument();
  });
});
