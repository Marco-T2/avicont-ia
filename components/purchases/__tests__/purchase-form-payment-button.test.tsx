/**
 * T-23 RED/GREEN — Button visibility logic on purchase-form
 * T-24 RED/GREEN — Button navigation href
 *
 * Predicate (DEC-1 / locked):
 *   canRegisterPayment = status === "POSTED" && payable != null && new Decimal(payable.balance).gt(0)
 *
 * Expected RED failure mode: button "Registrar pago" not found in DOM.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PurchaseForm from "../purchase-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockRole = vi.hoisted(() => ({ current: "admin" as string | null }));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: mockRole.current }),
}));

beforeEach(() => {
  mockRole.current = "admin";
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
  month: 1,
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

function makePayable(balance: number) {
  return {
    id: "payable-1",
    amount: 1000,
    balance,
    allocations: [],
  };
}

const BASE_PURCHASE: Record<string, unknown> = {
  id: "purchase-99",
  organizationId: "org-1",
  purchaseType: "COMPRA_GENERAL",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "POSTED",
  totalAmount: 1000,
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
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  journalEntryId: null,
  contact: { id: "contact-1", name: "Proveedor SA", type: "PROVEEDOR", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [
    {
      id: "det-1",
      purchaseId: "purchase-99",
      description: "Material",
      lineAmount: 1000,
      quantity: 1,
      unitPrice: 1000,
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
  payable: makePayable(1000),
};

function renderForm(patch: Record<string, unknown> = {}) {
  const purchase = { ...BASE_PURCHASE, ...patch };
  return render(
    <SystemRoleProvider role={mockRole.current}>
      <PurchaseForm
        orgSlug="mi-org"
        purchaseType="COMPRA_GENERAL"
        contacts={[BASE_CONTACT]}
        periods={[BASE_PERIOD]}
        productTypes={[]}
        purchase={purchase as any}
        mode="edit"
      />
    </SystemRoleProvider>,
  );
}

// ── T-23: Button visibility ──

describe("PurchaseForm — Registrar pago button visibility (T-23)", () => {
  it("T-23.1 — POSTED + payable.balance=1000 → button visible with text 'Registrar pago'", () => {
    renderForm({ status: "POSTED", payable: makePayable(1000) });
    expect(screen.getByRole("link", { name: /registrar pago/i })).toBeInTheDocument();
  });

  it("T-23.2 — POSTED + payable.balance=0 → button NOT visible", () => {
    renderForm({ status: "POSTED", payable: makePayable(0) });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });

  it("T-23.3 — POSTED + payable=null → button NOT visible", () => {
    renderForm({ status: "POSTED", payable: null });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });

  it("T-23.4 — LOCKED + payable.balance=1000 → button NOT visible", () => {
    renderForm({ status: "LOCKED", payable: makePayable(1000) });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });

  it("T-23.5 — DRAFT → button NOT visible", () => {
    renderForm({ status: "DRAFT", payable: null });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });

  it("T-23.6 — VOIDED → button NOT visible", () => {
    renderForm({ status: "VOIDED", payable: makePayable(1000) });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });
});

// ── T-24: Button href ──

describe("PurchaseForm — Registrar pago button href (T-24)", () => {
  it("T-24.1 — href = /{orgSlug}/payments/new?type=PAGO&purchaseId={purchase.id}", () => {
    renderForm({ status: "POSTED", payable: makePayable(1000) });
    const link = screen.getByRole("link", { name: /registrar pago/i });
    expect(link).toHaveAttribute(
      "href",
      "/mi-org/payments/new?type=PAGO&purchaseId=purchase-99",
    );
  });
});

// ── T-26: Permission gating (resource=payments, action=write) ──
// Matrix: payments/write = [owner, admin, contador, cobrador]. `member` queda fuera.
// Mirror de T-25 sobre purchases. Cierra W-1 del verify report.

describe("PurchaseForm — Permission gating (T-26)", () => {
  it("T-26.1 — role=cobrador (granted): botón visible", () => {
    mockRole.current = "cobrador";
    renderForm({ status: "POSTED", payable: makePayable(1000) });
    expect(screen.getByRole("link", { name: /registrar pago/i })).toBeInTheDocument();
  });

  it("T-26.2 — role=member (NOT granted): botón NO visible", () => {
    mockRole.current = "member";
    renderForm({ status: "POSTED", payable: makePayable(1000) });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });
});
