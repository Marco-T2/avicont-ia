/**
 * T6.1 RED — accounting-rbac PR6
 *
 * REQ-ui-gating (resource=purchases, action=write):
 * - matrix: purchases write = [owner, admin, contador]
 * - cobrador/member → acciones OCULTAS
 * - contador/admin/owner → VISIBLES
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseForm from "../purchase-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

const mockRole = vi.hoisted(() => ({ current: "owner" as string | null }));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: mockRole.current, isLoading: false, orgSlug: "test-org" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/iva-books/iva-book-purchase-modal", () => ({
  IvaBookPurchaseModal: () => null,
}));

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

const PRODUCT_TYPE = { id: "pt-1", name: "Pollo", code: "PLO" };

const BASE_PURCHASE = {
  id: "purchase-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "DRAFT" as string,
  totalAmount: 113,
  description: "Compra de prueba",
  referenceNumber: "F-001",
  notes: null,
  displayCode: "CE-001",
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
      description: "Item",
      expenseAccountId: "acc-1",
      lineAmount: 113,
      quantity: 1,
      unitPrice: 113,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  payable: null,
};

function renderForm(patch: Partial<typeof BASE_PURCHASE> = {}) {
  const purchase = { ...BASE_PURCHASE, ...patch };
  return render(
    <SystemRoleProvider role={mockRole.current}>
      <PurchaseForm
        orgSlug="test-org"
        purchaseType="COMPRA_GENERAL"
        contacts={[{ id: "contact-1", name: "Proveedor SA", type: "PROVEEDOR" as any, nit: "12345", paymentTermsDays: 30, organizationId: "org-1", createdAt: new Date(), updatedAt: new Date(), email: null, phone: null, address: null, creditLimit: null, isActive: true }]}
        periods={[BASE_PERIOD]}
        productTypes={[PRODUCT_TYPE]}
        purchase={purchase as any}
        mode="edit"
      />
    </SystemRoleProvider>,
  );
}

describe("PurchaseForm — RBAC gating (purchases/write)", () => {
  it("T6.1-pu-1 — role=cobrador, DRAFT: Guardar + Contabilizar OCULTOS", () => {
    mockRole.current = "cobrador";
    renderForm({ status: "DRAFT" });

    expect(screen.queryByRole("button", { name: /^guardar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar/i })).not.toBeInTheDocument();
  });

  it("T6.1-pu-2 — role=member, POSTED: Anular OCULTO", () => {
    mockRole.current = "member";
    renderForm({ status: "POSTED" });

    expect(screen.queryByRole("button", { name: /anular/i })).not.toBeInTheDocument();
  });

  it("T6.1-pu-3 — role=contador, DRAFT: Guardar + Contabilizar VISIBLES", () => {
    mockRole.current = "contador";
    renderForm({ status: "DRAFT" });

    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /contabilizar/i })).toBeInTheDocument();
  });

  it("T6.1-pu-4 — role=contador, POSTED: Anular VISIBLE", () => {
    mockRole.current = "contador";
    renderForm({ status: "POSTED" });

    expect(screen.getByRole("button", { name: /anular/i })).toBeInTheDocument();
  });
});
