/**
 * T6.1 RED — accounting-rbac PR6
 *
 * REQ-ui-gating (resource=sales, action=write):
 * - matrix: sales write = [owner, admin, contador]
 * - cobrador/member → acciones de escritura OCULTAS (Guardar, Contabilizar, Anular)
 * - contador/admin/owner → VISIBLES
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import SaleForm from "../sale-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

// ── Mocks ──

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
  status: "DRAFT" as string,
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

function renderForm(salePatch: Partial<typeof BASE_SALE> = {}) {
  const sale = { ...BASE_SALE, ...salePatch };
  return render(
    <SystemRoleProvider role={mockRole.current}>
      <SaleForm
        orgSlug="test-org"
        contacts={[{ id: "contact-1", name: "Cliente SA", type: "CLIENTE" as any, nit: "12345", paymentTermsDays: 30, organizationId: "org-1", createdAt: new Date(), updatedAt: new Date(), email: null, phone: null, address: null, creditLimit: null, isActive: true }]}
        periods={[BASE_PERIOD]}
        incomeAccounts={[INCOME_ACCOUNT]}
        sale={sale as any}
        mode="edit"
      />
    </SystemRoleProvider>,
  );
}

describe("SaleForm — RBAC gating (sales/write)", () => {
  it("T6.1-sa-1 — role=cobrador, DRAFT: Guardar + Contabilizar OCULTOS", () => {
    mockRole.current = "cobrador";
    renderForm({ status: "DRAFT" });

    expect(screen.queryByRole("button", { name: /^guardar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar/i })).not.toBeInTheDocument();
  });

  it("T6.1-sa-2 — role=member, POSTED: Guardar cambios + Anular OCULTOS", () => {
    mockRole.current = "member";
    renderForm({ status: "POSTED" });

    expect(screen.queryByRole("button", { name: /guardar cambios/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /anular/i })).not.toBeInTheDocument();
  });

  it("T6.1-sa-3 — role=contador, DRAFT: Guardar + Contabilizar VISIBLES", () => {
    mockRole.current = "contador";
    renderForm({ status: "DRAFT" });

    expect(screen.getByRole("button", { name: /^guardar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /contabilizar/i })).toBeInTheDocument();
  });

  it("T6.1-sa-4 — role=contador, POSTED: Guardar cambios + Anular VISIBLES", () => {
    mockRole.current = "contador";
    renderForm({ status: "POSTED" });

    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anular/i })).toBeInTheDocument();
  });
});

// ── Gap-closure: REQ-U.3-S2 — status-gate overrides role-gate ──────────────
// Proves that DRAFT-era buttons (Guardar / Contabilizar) are hidden on POSTED
// status even when role=owner has full write permission. Status-gating is
// orthogonal to role-gating: the <Gated> wrapper passes, but the nested
// `isEditMode && status === "DRAFT"` condition prevents rendering.
describe("SaleForm — status-gate orthogonal to role-gate (REQ-U.3-S2)", () => {
  it("REQ-U.3-S2 — role=owner, POSTED: draft-era buttons (Guardar/Contabilizar) HIDDEN, status-era buttons (Guardar cambios/Anular) VISIBLE", () => {
    mockRole.current = "owner";
    renderForm({ status: "POSTED" });

    // Status-gate: DRAFT buttons must NOT appear even though owner has write permission
    expect(screen.queryByRole("button", { name: /^guardar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar$/i })).not.toBeInTheDocument();

    // Role-gate passes + status is POSTED → POSTED-era buttons ARE visible
    expect(screen.getByRole("button", { name: /guardar cambios/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anular/i })).toBeInTheDocument();
  });
});
