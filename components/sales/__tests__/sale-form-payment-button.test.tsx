/**
 * T-20..T-22 — Payment shortcut button in SaleForm (Resumen de Cobros card)
 *
 * Locked predicate (non-negotiable):
 *   canRegisterPayment = status === "POSTED" && receivable != null && Decimal(balance).gt(0)
 * Period status is NOT checked (Option B1 — period validation delegated to /payments/new).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import SaleForm from "../sale-form";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "owner", isLoading: false, orgSlug: "test-org" }),
}));

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

const INCOME_ACCOUNT = { id: "acc-1", code: "4.1.1", name: "Ventas" };

const BASE_RECEIVABLE = {
  id: "recv-1",
  amount: 1000,
  paid: 0,
  balance: 1000,
  status: "OPEN",
  dueDate: new Date("2026-02-15"),
  allocations: [],
};

const BASE_SALE = {
  id: "sale-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "POSTED" as string,
  totalAmount: 1000,
  description: "Venta de prueba",
  referenceNumber: null,
  notes: null,
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  journalEntryId: null,
  contact: { id: "contact-1", name: "Cliente SA", type: "CLIENTE", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" as string },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [],
  receivable: BASE_RECEIVABLE,
};

const BASE_CONTACTS = [
  {
    id: "contact-1",
    name: "Cliente SA",
    type: "CLIENTE" as any,
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
  },
];

function renderForm(salePatch: Partial<typeof BASE_SALE> = {}) {
  const sale = { ...BASE_SALE, ...salePatch };
  return render(
    <SaleForm
      orgSlug="test-org"
      contacts={BASE_CONTACTS}
      periods={[BASE_PERIOD]}
      incomeAccounts={[INCOME_ACCOUNT]}
      sale={sale as any}
      mode="edit"
    />,
  );
}

// ── T-20: Button visibility ──

describe("T-20 — Botón 'Registrar pago' — visibilidad", () => {
  it("T-20-1 — POSTED + balance=1000 → botón visible con texto 'Registrar pago'", () => {
    renderForm({ status: "POSTED", receivable: { ...BASE_RECEIVABLE, balance: 1000 } });
    expect(screen.getByRole("link", { name: /registrar pago/i })).toBeInTheDocument();
  });

  it("T-20-2 — POSTED + balance=0 → botón NO visible", () => {
    renderForm({ status: "POSTED", receivable: { ...BASE_RECEIVABLE, balance: 0 } });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });

  it("T-20-3 — POSTED + receivable=undefined → botón NO visible", () => {
    renderForm({ status: "POSTED", receivable: undefined });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });

  it("T-20-4 — LOCKED + balance=1000 → botón NO visible (Option B: POSTED only)", () => {
    renderForm({ status: "LOCKED", receivable: { ...BASE_RECEIVABLE, balance: 1000 } });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });

  it("T-20-5 — DRAFT → botón NO visible", () => {
    renderForm({ status: "DRAFT", receivable: undefined });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });

  it("T-20-6 — VOIDED → botón NO visible", () => {
    renderForm({ status: "VOIDED", receivable: undefined });
    expect(screen.queryByRole("link", { name: /registrar pago/i })).not.toBeInTheDocument();
  });
});

// ── T-21: Button navigation href ──

describe("T-21 — Botón 'Registrar pago' — href", () => {
  it("T-21-1 — href = /{orgSlug}/payments/new?type=COBRO&saleId={sale.id}", () => {
    renderForm({ status: "POSTED", receivable: { ...BASE_RECEIVABLE, balance: 1000 } });
    const link = screen.getByRole("link", { name: /registrar pago/i });
    expect(link).toHaveAttribute(
      "href",
      "/test-org/payments/new?type=COBRO&saleId=sale-1",
    );
  });
});

// ── T-22: Period CLOSED does NOT block button (B1 regression lock) ──

describe("T-22 — Period CLOSED no bloquea el botón (B1 regression lock)", () => {
  it("T-22-1 — POSTED + period.status=CLOSED + balance=500 → botón VISIBLE (no se valida período)", () => {
    renderForm({
      status: "POSTED",
      period: { id: "period-1", name: "Enero 2026", status: "CLOSED" },
      receivable: { ...BASE_RECEIVABLE, balance: 500 },
    });
    expect(screen.getByRole("link", { name: /registrar pago/i })).toBeInTheDocument();
  });
});
