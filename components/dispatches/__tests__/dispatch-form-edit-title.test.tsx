/**
 * T2.6 — REQ-DISPLAY-1: DispatchForm edit-mode title renders
 *   `${DISPATCH_TYPE_LABEL[dispatchType]} #${sequenceNumber} — ${contact.name}`
 *   (Q4 format).
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   - title text MUST NOT match `/[A-Z]{1,3}-\d{3,4}/`; today header at
 *     L787-789 uses `${existingDispatch.displayCode} — ${DISPATCH_TYPE_LABEL[...]}`
 *     (e.g. "ND-001 — Nota de Despacho").
 *   - title text MUST contain literal `Nota de Despacho #7 — Cliente SA`
 *     for the fixture with sequenceNumber=7 + contact "Cliente SA".
 *
 * GREEN: in dispatch-form.tsx:787-789 replace template with
 *   `${DISPATCH_TYPE_LABEL[dispatchType]} #${existingDispatch.sequenceNumber} — ${existingDispatch.contact.name}`.
 *
 * dispatch.entity.toSnapshot() displayCode field retirement is T4.4c
 * (separate cycle); this cycle only touches the form render.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import DispatchForm from "../dispatch-form";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "admin" }),
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

const PROHIBITED = /[A-Z]{1,3}-\d{3,4}/;

function makeDispatch() {
  return {
    id: "dispatch-7",
    dispatchType: "NOTA_DESPACHO" as const,
    status: "POSTED" as const,
    sequenceNumber: 7,
    referenceNumber: null,
    displayCode: "ND-007",
    date: "2026-04-17T00:00:00.000Z",
    contactId: "contact-1",
    periodId: "period-1",
    description: "Despacho 7",
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

describe("T2.6 — DispatchForm edit title (REQ-DISPLAY-1)", () => {
  it("renders 'Nota de Despacho #${sequenceNumber} — ${contact.name}' (Q4)", () => {
    render(
      <DispatchForm
        orgSlug="test-org"
        dispatchType="NOTA_DESPACHO"
        contacts={[BASE_CONTACT]}
        periods={[BASE_PERIOD]}
        productTypes={[PRODUCT_TYPE]}
        roundingThreshold={0.5}
        existingDispatch={makeDispatch() as never}
      />,
    );
    expect(screen.getByText(/Nota de Despacho #7 — Cliente SA/)).toBeInTheDocument();
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(PROHIBITED);
  });
});
