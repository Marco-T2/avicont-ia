/**
 * T6.1 RED — accounting-rbac PR6
 *
 * REQ-ui-gating (resource=dispatches, action=write):
 * - matrix: dispatches write = [owner, admin]
 * - contador/cobrador/member → acciones OCULTAS (Guardar Borrador/Contabilizar)
 * - admin/owner → VISIBLES
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import DispatchForm from "../dispatch-form";
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

const BASE_PERIOD = {
  id: "period-1",
  name: "Enero 2026",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-31"),
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

const PRODUCT_TYPE = { id: "pt-1", name: "Pollo", code: "PLO" };

function renderCreateMode() {
  return render(
    <SystemRoleProvider role={mockRole.current}>
      <DispatchForm
        orgSlug="test-org"
        dispatchType="NOTA_DESPACHO"
        contacts={[BASE_CONTACT]}
        periods={[BASE_PERIOD]}
        productTypes={[PRODUCT_TYPE]}
        roundingThreshold={0.5}
      />
    </SystemRoleProvider>,
  );
}

describe("DispatchForm — RBAC gating (dispatches/write)", () => {
  it("T6.1-di-1 — role=contador: Guardar Borrador + Contabilizar OCULTOS", () => {
    mockRole.current = "contador";
    renderCreateMode();

    expect(screen.queryByRole("button", { name: /guardar borrador/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar/i })).not.toBeInTheDocument();
  });

  it("T6.1-di-2 — role=cobrador: acciones OCULTAS", () => {
    mockRole.current = "cobrador";
    renderCreateMode();

    expect(screen.queryByRole("button", { name: /guardar borrador/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar/i })).not.toBeInTheDocument();
  });

  it("T6.1-di-4 — role=admin: acciones VISIBLES", () => {
    mockRole.current = "admin";
    renderCreateMode();

    expect(screen.getByRole("button", { name: /guardar borrador/i })).toBeInTheDocument();
  });
});
