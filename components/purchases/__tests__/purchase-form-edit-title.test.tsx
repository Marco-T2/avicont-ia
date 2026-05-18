/**
 * T2.5-form — REQ-DISPLAY-1: PurchaseForm edit-mode title renders
 *   `${PURCHASE_TYPE_LABEL[purchaseType]} #${sequenceNumber} — ${contact.name}`
 *   (Q4 format).
 *
 * RED expected failure mode (declared per [[red_acceptance_failure_mode]]):
 *   - title text MUST NOT match `/[A-Z]{1,3}-\d{3,4}/`; today header at
 *     L691-693 uses `${purchase!.displayCode} — ${PURCHASE_TYPE_LABEL[...]}`
 *     (e.g. "CG-001 — Compra General").
 *   - title text MUST contain literal `Compra General #5 — Proveedor SA`
 *     for the fixture with sequenceNumber=5 + contact "Proveedor SA".
 *
 * GREEN: in purchase-form.tsx:691-693 replace template with
 *   `${PURCHASE_TYPE_LABEL[purchaseType]} #${purchase.sequenceNumber} — ${purchase.contact.name}`.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseForm from "../purchase-form";

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

const PROHIBITED = /[A-Z]{1,3}-\d{3,4}/;

function makePurchase() {
  return {
    id: "purchase-1",
    organizationId: "org-1",
    purchaseType: "COMPRA_GENERAL" as const,
    periodId: "period-1",
    contactId: "contact-1",
    sequenceNumber: 5,
    date: new Date("2026-01-15"),
    status: "POSTED" as string,
    totalAmount: 100,
    description: "Compra",
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
    contact: BASE_CONTACT,
    period: { id: "period-1", name: "Enero 2026", status: "OPEN" as string },
    details: [
      {
        id: "det-1",
        purchaseId: "purchase-1",
        description: "Material",
        lineAmount: 100,
        quantity: 1,
        unitPrice: 100,
        order: 0,
        expenseAccountId: "acc-1",
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
    payable: null,
  };
}

describe("T2.5-form — PurchaseForm edit title (REQ-DISPLAY-1)", () => {
  it("renders 'Compra General #${sequenceNumber} — ${contact.name}' (Q4)", () => {
    render(
      <PurchaseForm
        orgSlug="test-org"
        purchaseType="COMPRA_GENERAL"
        contacts={[BASE_CONTACT]}
        periods={[BASE_PERIOD]}
        productTypes={[]}
        purchase={makePurchase() as never}
        mode="edit"
      />,
    );
    expect(screen.getByText(/Compra General #5 — Proveedor SA/)).toBeInTheDocument();
    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(PROHIBITED);
  });
});
