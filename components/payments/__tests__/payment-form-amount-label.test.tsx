/**
 * Direction-aware amount label: the budget input label was hardcoded to
 * "Importe recibido (Bs.)" regardless of direction. Correct for COBRO (money
 * coming IN), but wrong for PAGO (a supplier payment is money going OUT) — it
 * must read "Importe pagado (Bs.)".
 *
 * RED (pre-implementation) — expected failure mode:
 *   - For a PAGO payment, getByLabelText(/importe pagado/i) THROWS — the label
 *     is hardcoded to "Importe recibido (Bs.)" for both directions.
 *   - The COBRO case is a regression guard: it must keep reading
 *     "Importe recibido" after the fix.
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
  global.fetch = vi.fn(async (url: string) => {
    let payload: Record<string, unknown> = {};
    if (typeof url === "string" && url.includes("/pending-documents")) {
      payload = { documents: [] };
    } else if (typeof url === "string" && url.includes("/credit-balance")) {
      payload = { creditBalance: 0 };
    } else if (typeof url === "string" && url.includes("/unapplied-payments")) {
      payload = { payments: [] };
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});

const BASE_PERIOD = {
  id: "period-1",
  name: "Mayo 2026",
  startDate: new Date("2026-05-01"),
  endDate: new Date("2026-05-31"),
  status: "OPEN" as const,
  organizationId: "org-1",
  year: 2026,
  createdById: "user-1",
  month: 5,
  closedAt: null,
  closedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BASE_CONTACTS = [
  { id: "contact-1", name: "Marco", type: "CLIENTE" },
  { id: "contact-2", name: "Proveedor X", type: "PROVEEDOR" },
];

function makeEditPayment(over?: Record<string, unknown>) {
  return {
    id: "pay-1",
    organizationId: "org-1",
    periodId: "period-1",
    contactId: "contact-1",
    type: "COBRO",
    direction: "COBRO",
    method: "TRANSFERENCIA",
    amount: 2000,
    description: "COBRO TRANSFERENCIA: Marco",
    date: new Date("2026-05-23"),
    status: "DRAFT",
    notes: null,
    operationalDocTypeId: null,
    operationalDocType: null,
    referenceNumber: 6456,
    accountCode: null,
    createdById: "user-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    journalEntryId: null,
    contact: { id: "contact-1", name: "Marco", type: "CLIENTE" },
    period: { id: "period-1", name: "Mayo 2026", status: "OPEN" },
    allocations: [],
    ...over,
  };
}

function renderForm(payment = makeEditPayment()) {
  return render(
    <SystemRoleProvider role="owner">
      <PaymentForm
        orgSlug="test-org"
        contacts={BASE_CONTACTS}
        periods={[BASE_PERIOD]}
        existingPayment={payment as never}
      />
    </SystemRoleProvider>,
  );
}

// A PAGO payment: direction is inferred from the PROVEEDOR contact (inferDirection).
function makePagoPayment() {
  return makeEditPayment({
    type: "PAGO",
    direction: "PAGO",
    contactId: "contact-2",
    contact: { id: "contact-2", name: "Proveedor X", type: "PROVEEDOR" },
  });
}

describe("payment-form amount label — direction-aware", () => {
  it("reads 'Importe pagado' for a PAGO payment (money going out)", async () => {
    renderForm(makePagoPayment());

    expect(await screen.findByLabelText(/importe pagado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/importe recibido/i)).toBeNull();
  });

  it("keeps 'Importe recibido' for a COBRO payment (money coming in)", async () => {
    renderForm();

    expect(
      await screen.findByLabelText(/importe recibido/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/importe pagado/i)).toBeNull();
  });
});
