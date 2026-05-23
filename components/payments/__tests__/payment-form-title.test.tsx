/**
 * Visualization change — the payment detail card title shows the operational
 * document type (the doc the payment was created with) + reference number,
 * NOT the full glosa.
 *
 * Before: `${tipo} — ${existingPayment.description}` repeated the whole glosa
 *   (e.g. "Cobro — COBRO TRANSFERENCIA: Marco Bs. 2.000,00: VG- del 22/05"),
 *   which already lives verbatim in the "Descripción" field below the title.
 *   Showing it twice was redundant and confusing (Marco's feedback).
 * After: `${tipo} — ${operationalDocType.name} N° ${referenceNumber}`
 *   (format choice "Nombre + ref"), with graceful fallbacks:
 *   - no ref       → `${tipo} — ${name}`
 *   - no doc type  → `${tipo} — N° ${ref}`
 *   - neither      → `${tipo}`
 *
 * RED (pre-implementation) — expected failure mode:
 *   - getByText("Cobro — Recibo de Cobranza N° 6456") THROWS — the current title
 *     is built from the description glosa, not from doc type + ref.
 *   - queryByText(/Cobro — COBRO TRANSFERENCIA/) expected null but is PRESENT —
 *     the current title still embeds the glosa.
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
    description: "COBRO TRANSFERENCIA: Marco Bs. 2.000,00: VG- del 22/05",
    date: new Date("2026-05-23"),
    status: "DRAFT",
    notes: null,
    operationalDocTypeId: "dt-1",
    operationalDocType: { id: "dt-1", code: "RC", name: "Recibo de Cobranza" },
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

describe("payment-form card title — doc type + ref (not the glosa)", () => {
  it("shows '{tipo} — {docTypeName} N° {ref}' and drops the description glosa", async () => {
    renderForm();

    expect(
      await screen.findByText("Cobro — Recibo de Cobranza N° 6456"),
    ).toBeInTheDocument();
    // The full glosa is no longer embedded in the title.
    expect(screen.queryByText(/Cobro — COBRO TRANSFERENCIA/)).toBeNull();
  });

  it("falls back to '{tipo} — {docTypeName}' when there is no reference number", async () => {
    renderForm(makeEditPayment({ referenceNumber: null }));

    expect(
      await screen.findByText("Cobro — Recibo de Cobranza"),
    ).toBeInTheDocument();
  });

  it("falls back to '{tipo} — N° {ref}' when there is no operational doc type", async () => {
    renderForm(
      makeEditPayment({ operationalDocType: null, operationalDocTypeId: null }),
    );

    expect(await screen.findByText("Cobro — N° 6456")).toBeInTheDocument();
  });

  it("uses 'Pago' as the prefix for a PAGO payment", async () => {
    // paymentType is inferred from the contact (inferDirection): point the
    // payment at a PROVEEDOR contact so the form resolves direction = PAGO.
    renderForm(
      makeEditPayment({
        type: "PAGO",
        direction: "PAGO",
        contactId: "contact-2",
        contact: { id: "contact-2", name: "Proveedor X", type: "PROVEEDOR" },
      }),
    );

    const title = await screen.findByText("Pago — Recibo de Cobranza N° 6456");
    expect(title).toBeInTheDocument();
    // Sanity: it's the heading-level title, not stray body text.
    expect(within(title).queryByText(/TRANSFERENCIA/)).toBeNull();
  });
});
