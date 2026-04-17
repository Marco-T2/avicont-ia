/**
 * T3.3 RED → T3.4 GREEN
 * REQ-A.1 (removal): The footer "Registrar Libro de Compras" button is GONE.
 * These tests are REWRITTEN to target the LcvIndicator in header row 2.
 *
 * LcvIndicator gate: periodOpen prop drives disabled state.
 * - OPEN period → indicator interactive (S2 or S3)
 * - CLOSED period → indicator disabled (S1 — treated same as draft for period-closed gate)
 *
 * The original SPEC-5 gate behavior (OPEN → enabled, CLOSED → disabled) is
 * now verified via data-lcv-state instead of the footer button.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseForm from "../purchase-form";

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

const BASE_PURCHASE = {
  id: "purchase-1",
  organizationId: "org-1",
  purchaseType: "COMPRA_GENERAL" as const,
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "DRAFT" as string,
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

function renderForm(purchasePatch: Partial<typeof BASE_PURCHASE> = {}) {
  const purchase = { ...BASE_PURCHASE, ...purchasePatch };
  return render(
    <PurchaseForm
      orgSlug="test-org"
      purchaseType="COMPRA_GENERAL"
      contacts={[{ id: "contact-1", name: "Proveedor SA", type: "PROVEEDOR" as any, nit: "12345", paymentTermsDays: 30, organizationId: "org-1", createdAt: new Date(), updatedAt: new Date(), email: null, phone: null, address: null, creditLimit: null, isActive: true }]}
      periods={[BASE_PERIOD]}
      productTypes={[]}
      purchase={purchase as any}
      mode="edit"
    />,
  );
}

// ── Tests ──

describe("PurchaseForm — IVA LcvIndicator fiscal period gate (SPEC-5, REQ-A.1)", () => {
  it("5.4a — OPEN period + DRAFT purchase → LcvIndicator renders S1 (DRAFT gate) and footer has NO 'Registrar Libro de Compras' button", () => {
    const { container } = renderForm({ status: "DRAFT", period: { id: "period-1", name: "Enero 2026", status: "OPEN" } });
    // Header indicator is S1 because purchase is DRAFT
    const indicator = container.querySelector("[data-lcv-state]");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveAttribute("data-lcv-state", "S1");
    // Footer must NOT contain the old button
    const footerBtn = screen.queryByRole("button", { name: /registrar libro de compras/i });
    expect(footerBtn).not.toBeInTheDocument();
  });

  it("5.4b — OPEN period + POSTED purchase → LcvIndicator S2 (no ivaPurchaseBook) and NOT disabled", () => {
    const { container } = renderForm({ status: "POSTED", period: { id: "period-1", name: "Enero 2026", status: "OPEN" } });
    const indicator = container.querySelector("[data-lcv-state='S2']");
    expect(indicator).toBeInTheDocument();
    expect(indicator).not.toBeDisabled();
    // Footer must NOT contain the old button
    const footerBtn = screen.queryByRole("button", { name: /registrar libro de compras/i });
    expect(footerBtn).not.toBeInTheDocument();
  });

  it("5.4c — CLOSED period + POSTED purchase → LcvIndicator S2 but disabled (period closed)", () => {
    const { container } = renderForm({ status: "POSTED", period: { id: "period-1", name: "Enero 2026", status: "CLOSED" } });
    const indicator = container.querySelector("[data-lcv-state='S2']");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toBeDisabled();
    // Footer must NOT contain the old button
    const footerBtn = screen.queryByRole("button", { name: /registrar libro de compras/i });
    expect(footerBtn).not.toBeInTheDocument();
  });

  it("5.4d — CLOSED period + DRAFT purchase → LcvIndicator S1 (disabled) and footer has NO 'Registrar Libro de Compras' button", () => {
    const { container } = renderForm({ status: "DRAFT", period: { id: "period-1", name: "Enero 2026", status: "CLOSED" } });
    const indicator = container.querySelector("[data-lcv-state='S1']");
    expect(indicator).toBeInTheDocument();
    expect(indicator).toBeDisabled();
    // Footer must NOT contain the old button
    const footerBtn = screen.queryByRole("button", { name: /registrar libro de compras/i });
    expect(footerBtn).not.toBeInTheDocument();
  });
});
