/**
 * RED → GREEN
 *
 * Mirror del patrón de journal (REQ-A.2, journal-entry-detail.tsx:104-108):
 * un documento LOCKED es SOLO LECTURA en la UI. No se ofrece edición con
 * justificación — el modal `JustificationModal` se elimina de payment-form.
 *
 * Backend INTACTO: validateLockedEdit / REQ-A6 sigue existiendo, solo deja de
 * alcanzarse desde la UI (igual que journal).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaymentForm from "../payment-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

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

beforeEach(() => {
  // LOCKED fixture has a contactId → mount fires fetchPendingDocuments. Stub
  // global fetch so the effect resolves without network noise (errors caught
  // internally either way).
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
  );
});

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

// Cast as any: PaymentWithRelations is a heavy Prisma-derived shape; the form
// only reads the scalar seeds + allocations[] + contact/period on render.
const LOCKED_PAYMENT = {
  id: "pay-locked-1",
  status: "LOCKED",
  contactId: "contact-1",
  date: new Date("2026-04-15"),
  periodId: "period-1",
  method: "EFECTIVO",
  accountCode: null,
  description: "Pago bloqueado",
  notes: null,
  operationalDocTypeId: null,
  referenceNumber: null,
  amount: 100,
  allocations: [],
  contact: BASE_CONTACT,
  period: BASE_PERIOD,
  journalEntry: null,
} as any;

function renderLockedForm() {
  return render(
    <SystemRoleProvider role="owner">
      <PaymentForm
        orgSlug="test-org"
        contacts={[BASE_CONTACT]}
        periods={[BASE_PERIOD]}
        existingPayment={LOCKED_PAYMENT}
        defaultType="COBRO"
      />
    </SystemRoleProvider>,
  );
}

describe("PaymentForm — LOCKED es solo lectura (espejo journal)", () => {
  it("no muestra botón 'Guardar' para un pago LOCKED (admin/owner)", () => {
    renderLockedForm();
    expect(
      screen.queryByRole("button", { name: /^guardar$/i }),
    ).not.toBeInTheDocument();
  });

  it("no muestra botón 'Anular' para un pago LOCKED (admin/owner)", () => {
    renderLockedForm();
    expect(
      screen.queryByRole("button", { name: /^anular$/i }),
    ).not.toBeInTheDocument();
  });
});
