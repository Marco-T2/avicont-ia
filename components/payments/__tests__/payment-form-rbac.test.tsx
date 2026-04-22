/**
 * T6.1 RED — accounting-rbac PR6
 *
 * REQ-ui-gating (resource=payments, action=write):
 * - matrix: payments write = [owner, admin, contador, cobrador]
 * - member → acciones OCULTAS (Guardar Borrador, Contabilizar)
 * - cobrador/contador/admin/owner → VISIBLES
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaymentForm from "../payment-form";
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

vi.mock("@/components/shared/justification-modal", () => ({
  JustificationModal: () => null,
}));

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

function renderNewForm() {
  return render(
    <SystemRoleProvider role={mockRole.current}>
      <PaymentForm
        orgSlug="test-org"
        contacts={[BASE_CONTACT]}
        periods={[BASE_PERIOD]}
        existingPayment={undefined}
        defaultType="COBRO"
      />
    </SystemRoleProvider>,
  );
}

describe("PaymentForm — RBAC gating (payments/write)", () => {
  it("T6.1-pa-1 — role=member: Guardar Borrador + Contabilizar OCULTOS", () => {
    mockRole.current = "member";
    renderNewForm();

    expect(screen.queryByRole("button", { name: /guardar borrador/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar/i })).not.toBeInTheDocument();
  });

  it("T6.1-pa-2 — role=member: acciones OCULTAS", () => {
    mockRole.current = "member";
    renderNewForm();

    expect(screen.queryByRole("button", { name: /guardar borrador/i })).not.toBeInTheDocument();
  });

  it("T6.1-pa-3 — role=cobrador: Guardar Borrador + Contabilizar VISIBLES", () => {
    mockRole.current = "cobrador";
    renderNewForm();

    expect(screen.getByRole("button", { name: /guardar borrador/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /contabilizar/i })).toBeInTheDocument();
  });

  it("T6.1-pa-4 — role=contador: acciones VISIBLES", () => {
    mockRole.current = "contador";
    renderNewForm();

    expect(screen.getByRole("button", { name: /guardar borrador/i })).toBeInTheDocument();
  });
});
