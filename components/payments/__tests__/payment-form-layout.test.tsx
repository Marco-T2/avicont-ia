/**
 * Visualization change — collapse the standalone "Importe recibido" card into the
 * allocations card (4 sections → 3), removing the thin half-empty card.
 *
 * Before: "Importe recibido" + the Aplicado/Restante summary lived in their own
 *   <Card> between the header and the allocations table.
 * After: that row is the top of the "Asignación a CxC/CxP" card, sitting right
 *   above the table it feeds (Marco: budget + Restante are coupled to the lines,
 *   QuickBooks-style — keep them next to the table, not floating in their own card).
 *
 * Behavior is unchanged: the same input (label "Importe recibido") and the same
 * `payment-restante` testid are rendered — only their DOM home moves.
 *
 * RED (pre-implementation) — expected failure mode:
 *   - within(allocationsCard).getByLabelText(/importe recibido/i) THROWS — the
 *     input is still in a separate sibling card, not inside the allocations card.
 */
import { render, screen, cleanup, within } from "@testing-library/react";
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

const BASE_CONTACTS = [{ id: "contact-1", name: "Marco", type: "CLIENTE" }];

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

function allocationsCard(): HTMLElement {
  const card = screen
    .getByText(/Asignación a Cuentas por Cobrar/)
    .closest('[data-slot="card"]');
  if (!card) throw new Error("allocations card not found");
  return card as HTMLElement;
}

describe("payment-form layout — Importe recibido folded into the allocations card", () => {
  it("renders 'Importe recibido' and the Restante summary inside the allocations card", async () => {
    renderForm();
    await screen.findByText(/Asignación a Cuentas por Cobrar/);

    const card = allocationsCard();
    expect(
      within(card).getByLabelText(/importe recibido/i),
    ).toBeInTheDocument();
    expect(within(card).getByTestId("payment-restante")).toBeInTheDocument();
  });

  it("still hides 'Importe recibido' for a voided payment", async () => {
    renderForm(makeEditPayment({ status: "VOIDED" }));
    await screen.findByText(/Asignación a Cuentas por Cobrar/);

    expect(screen.queryByLabelText(/importe recibido/i)).toBeNull();
  });
});
