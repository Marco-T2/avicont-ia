/**
 * RED → GREEN
 *
 * Espejo del patrón de journal (REQ-A.2): un documento LOCKED es SOLO LECTURA
 * en la UI. Se elimina el `JustificationModal` de dispatch-form (igual que ya
 * se hizo en payment-form). Backend INTACTO: validateLockedEdit sigue vigente,
 * solo deja de alcanzarse desde la UI.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import DispatchForm from "../dispatch-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "owner" }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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

const PRODUCT_TYPE = { id: "pt-1", name: "Pollo", code: "PLO" };

// Status LOCKED — espejo journal: debe quedar solo lectura.
function makeLockedDispatch() {
  return {
    id: "dispatch-7",
    dispatchType: "NOTA_DESPACHO" as const,
    status: "LOCKED" as const,
    sequenceNumber: 7,
    referenceNumber: null,
    date: "2026-04-17T00:00:00.000Z",
    contactId: "contact-1",
    periodId: "period-1",
    description: "Despacho bloqueado",
    notes: null,
    totalAmount: 100,
    farmOrigin: null,
    chickenCount: null,
    shrinkagePct: null,
    contact: { id: "contact-1", name: "Cliente SA", type: "CLIENTE" },
    details: [
      {
        id: "det-1",
        productTypeId: "pt-1",
        productType: { id: "pt-1", name: "Pollo", code: "PLO" },
        detailNote: null,
        description: "Pollo",
        boxes: 1,
        grossWeight: 10,
        tare: 0,
        netWeight: 10,
        unitPrice: 10,
        shrinkage: null,
        shortage: null,
        realNetWeight: null,
        lineAmount: 100,
        order: 0,
      },
    ],
    receivable: null,
  };
}

function renderLockedForm() {
  return render(
    <SystemRoleProvider role="owner">
      <DispatchForm
        orgSlug="test-org"
        dispatchType="NOTA_DESPACHO"
        contacts={[BASE_CONTACT]}
        periods={[BASE_PERIOD]}
        productTypes={[PRODUCT_TYPE]}
        roundingThreshold={0.5}
        existingDispatch={makeLockedDispatch() as never}
      />
    </SystemRoleProvider>,
  );
}

describe("DispatchForm — LOCKED es solo lectura (espejo journal)", () => {
  it("no muestra botón 'Guardar' para un despacho LOCKED (admin/owner)", () => {
    renderLockedForm();
    expect(
      screen.queryByRole("button", { name: /^guardar$/i }),
    ).not.toBeInTheDocument();
  });

  it("no muestra botón 'Anular' para un despacho LOCKED (admin/owner)", () => {
    renderLockedForm();
    expect(
      screen.queryByRole("button", { name: /^anular$/i }),
    ).not.toBeInTheDocument();
  });
});
