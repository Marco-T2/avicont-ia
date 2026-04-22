/**
 * T4.4 RED → T4.9 GREEN (partial: dispatch-form)
 *
 * REQ-C.2 — dispatch-form.tsx display sites use formatDateBO():
 *   - line 794: read-only Fecha in compact header (VOIDED/LOCKED read-only)
 *   - line 1444: "Pago el" payment.date in Resumen de Cobros (POSTED/LOCKED)
 *
 * Both must render "DD/MM/YYYY" instead of old "17/4/2026" bare locale output.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import DispatchForm from "../dispatch-form";

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

const BASE_DETAIL = {
  id: "det-1",
  productTypeId: "pt-1",
  productType: { id: "pt-1", name: "Pollo", code: "PLO" },
  detailNote: null,
  description: "Pollo",
  boxes: 10,
  grossWeight: 200,
  tare: 20,
  netWeight: 180,
  unitPrice: 5,
  shrinkage: null,
  shortage: null,
  realNetWeight: null,
  lineAmount: 900,
  order: 0,
};

// VOIDED dispatch for read-only header view (line 794)
const VOIDED_DISPATCH = {
  id: "dispatch-1",
  dispatchType: "NOTA_DESPACHO" as const,
  status: "VOIDED" as const,
  sequenceNumber: 1,
  referenceNumber: null,
  displayCode: "ND-001",
  date: "2026-04-17T00:00:00.000Z",
  contactId: "contact-1",
  periodId: "period-1",
  description: "Despacho anulado",
  notes: null,
  totalAmount: 900,
  farmOrigin: null,
  chickenCount: null,
  shrinkagePct: null,
  contact: { id: "contact-1", name: "Cliente SA" },
  details: [BASE_DETAIL],
  receivable: null,
};

// POSTED dispatch with receivable for payment date (line 1444)
const POSTED_DISPATCH_WITH_RECEIVABLE = {
  id: "dispatch-2",
  dispatchType: "NOTA_DESPACHO" as const,
  status: "POSTED" as const,
  sequenceNumber: 2,
  referenceNumber: null,
  displayCode: "ND-002",
  date: "2026-04-17T12:00:00.000Z",
  contactId: "contact-1",
  periodId: "period-1",
  description: "Despacho con cobro",
  notes: null,
  totalAmount: 900,
  farmOrigin: null,
  chickenCount: null,
  shrinkagePct: null,
  contact: { id: "contact-1", name: "Cliente SA" },
  details: [BASE_DETAIL],
  receivable: {
    id: "rec-1",
    amount: 900,
    paid: 500,
    balance: 400,
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

function renderVoidedDispatch() {
  return render(
    <DispatchForm
      orgSlug="test-org"
      dispatchType="NOTA_DESPACHO"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[PRODUCT_TYPE]}
      roundingThreshold={0.5}
      existingDispatch={VOIDED_DISPATCH as any}
    />,
  );
}

function renderPostedWithReceivable() {
  return render(
    <DispatchForm
      orgSlug="test-org"
      dispatchType="NOTA_DESPACHO"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[PRODUCT_TYPE]}
      roundingThreshold={0.5}
      existingDispatch={POSTED_DISPATCH_WITH_RECEIVABLE as any}
    />,
  );
}

// ── Tests ──

describe("DispatchForm — display date format (REQ-C.2)", () => {
  it("C.2.3 — read-only Fecha header (VOIDED) renders DD/MM/YYYY", () => {
    renderVoidedDispatch();
    expect(screen.getByText("17/04/2026")).toBeInTheDocument();
  });

  it("C.2.4 — read-only Fecha does NOT render old bare locale format", () => {
    renderVoidedDispatch();
    // Old format: "17/4/2026" (no zero-pad from bare toLocaleDateString)
    expect(screen.queryByText("17/4/2026")).not.toBeInTheDocument();
  });

  it("C.2.5 — payment.date in Resumen de Cobros renders DD/MM/YYYY", () => {
    renderPostedWithReceivable();
    // Payment date "2026-04-05T00:00:00.000Z" → "05/04/2026"
    expect(screen.getByText(/Pago el\s+05\/04\/2026/)).toBeInTheDocument();
  });

  it("C.2.6 — payment.date does NOT render old locale format", () => {
    renderPostedWithReceivable();
    expect(screen.queryByText(/Pago el\s+5\/4\/2026/)).not.toBeInTheDocument();
  });
});
