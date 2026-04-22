/**
 * T4.5 RED → T4.10 GREEN (partial: purchase-form)
 *
 * REQ-D.2 — purchase-form.tsx display sites use formatDateBO():
 *   - line 684: read-only Fecha in compact header (VOIDED/LOCKED)
 *   - line 1465: "Pago el" payment.date in Resumen de Pagos (POSTED/LOCKED)
 *
 * Both must render "DD/MM/YYYY" instead of old "17/4/2026" bare locale output.
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

const PRODUCT_TYPE = { id: "pt-1", name: "Pollo", code: "PLO" };

const BASE_PURCHASE_FIELDS = {
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  referenceNumber: null,
  description: "Compra test",
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

// VOIDED purchase for read-only header (line 684)
const VOIDED_PURCHASE = {
  ...BASE_PURCHASE_FIELDS,
  id: "purchase-1",
  purchaseType: "COMPRA_GENERAL",
  date: new Date("2026-04-17T00:00:00.000Z"),
  status: "VOIDED",
  totalAmount: 500,
  displayCode: "CG-001",
};

// POSTED purchase with payable for payment date (line 1465)
const POSTED_PURCHASE_WITH_PAYABLE = {
  ...BASE_PURCHASE_FIELDS,
  id: "purchase-2",
  purchaseType: "COMPRA_GENERAL",
  date: new Date("2026-04-17T12:00:00.000Z"),
  status: "POSTED",
  totalAmount: 1000,
  displayCode: "CG-002",
  payable: {
    id: "payable-1",
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

function renderVoidedPurchase() {
  return render(
    <PurchaseForm
      orgSlug="test-org"
      purchaseType="COMPRA_GENERAL"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[PRODUCT_TYPE]}
      purchase={VOIDED_PURCHASE as any}
      mode="edit"
    />,
  );
}

function renderPostedWithPayable() {
  return render(
    <PurchaseForm
      orgSlug="test-org"
      purchaseType="COMPRA_GENERAL"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[PRODUCT_TYPE]}
      purchase={POSTED_PURCHASE_WITH_PAYABLE as any}
      mode="edit"
    />,
  );
}

// ── Tests ──

describe("PurchaseForm — display date format (REQ-D.2)", () => {
  it("D.2.1 — read-only Fecha header (VOIDED) renders DD/MM/YYYY", () => {
    renderVoidedPurchase();
    expect(screen.getByText("17/04/2026")).toBeInTheDocument();
  });

  it("D.2.2 — read-only Fecha does NOT render old bare locale format", () => {
    renderVoidedPurchase();
    // Old format: "17/4/2026" (no zero-pad)
    expect(screen.queryByText("17/4/2026")).not.toBeInTheDocument();
  });

  it("D.2.3 — payment.date in Resumen de Pagos renders DD/MM/YYYY", () => {
    renderPostedWithPayable();
    // Payment date "2026-04-05T00:00:00.000Z" → "05/04/2026"
    expect(screen.getByText(/Pago el\s+05\/04\/2026/)).toBeInTheDocument();
  });

  it("D.2.4 — payment.date does NOT render old locale format", () => {
    renderPostedWithPayable();
    expect(screen.queryByText(/Pago el\s+5\/4\/2026/)).not.toBeInTheDocument();
  });
});
