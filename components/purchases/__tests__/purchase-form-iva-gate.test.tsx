/**
 * Tests RTL: gate del botón "Registrar Libro de Compras" por fiscalPeriod.status.
 *
 * SPEC-5: el botón debe estar habilitado cuando period.status === "OPEN"
 * y deshabilitado (con tooltip) cuando === "CLOSED".
 * NO depende de purchase.status (DRAFT o POSTED → habilitado si OPEN).
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
  status: "DRAFT" as const,
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
  contact: { id: "contact-1", name: "Proveedor SA", type: "SUPPLIER", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" as const },
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
      contacts={[{ id: "contact-1", name: "Proveedor SA", type: "SUPPLIER", nit: "12345", paymentTermsDays: 30, organizationId: "org-1", createdAt: new Date(), updatedAt: new Date(), notes: null, email: null, phone: null, address: null, createdById: "user-1", updatedById: null }]}
      periods={[BASE_PERIOD]}
      productTypes={[]}
      purchase={purchase as any}
      mode="edit"
    />,
  );
}

// ── Tests ──

describe("PurchaseForm — IVA button fiscal period gate (SPEC-5)", () => {
  it("5.4a — OPEN period + DRAFT purchase → button is enabled", () => {
    renderForm({ status: "DRAFT", period: { id: "period-1", name: "Enero 2026", status: "OPEN" } });
    const btn = screen.getByRole("button", { name: /registrar libro de compras/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("5.4b — OPEN period + POSTED purchase → button is STILL enabled (not gated by DRAFT)", () => {
    renderForm({ status: "POSTED", period: { id: "period-1", name: "Enero 2026", status: "OPEN" } });
    const btn = screen.getByRole("button", { name: /registrar libro de compras/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("5.4c — CLOSED period → button is disabled with tooltip message", () => {
    renderForm({ status: "DRAFT", period: { id: "period-1", name: "Enero 2026", status: "CLOSED" } });
    const btn = screen.getByRole("button", { name: /registrar libro de compras/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "El período fiscal está cerrado.");
  });

  it("5.4d — CLOSED period + POSTED purchase → button is also disabled", () => {
    renderForm({ status: "POSTED", period: { id: "period-1", name: "Enero 2026", status: "CLOSED" } });
    const btn = screen.getByRole("button", { name: /registrar libro de compras/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "El período fiscal está cerrado.");
  });
});
