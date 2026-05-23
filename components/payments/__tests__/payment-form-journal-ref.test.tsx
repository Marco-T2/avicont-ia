/**
 * Visualization change — the "Asiento Contable" reference (shown for POSTED
 * payments) is enriched from a bare "#{number}" to the voucher TYPE + number +
 * date, and becomes a link to the journal entry detail.
 *
 * Before: `Asiento Contable: #3` (plain text, no voucher type).
 * After:  `Asiento Contable: Comprobante de Ingreso N° 3 · 23/05/2026`
 *         rendered as a link to /{orgSlug}/accounting/journal/{id}.
 *
 * NOTE: the voucher type is NOT a free UI change — `journalEntry.voucherType` is
 * a Prisma relation that the payment include did not load (journalEntry: true =
 * scalars only). GREEN also extends the mapper include + the DTO type.
 *
 * RED (pre-implementation) — expected failure mode:
 *   - getByRole("link", { name: /Comprobante de Ingreso/ }) THROWS — the current
 *     reference is a plain <span> showing "#3", not a link, and the voucher type
 *     is neither loaded nor rendered.
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

const BASE_CONTACTS = [{ id: "contact-1", name: "Marco", type: "CLIENTE" }];

const JOURNAL_ENTRY = {
  id: "je-1",
  number: 3,
  date: "2026-05-23T12:00:00.000Z",
  description: "Asiento del cobro",
  voucherType: { id: "vt-1", code: "CI", name: "Comprobante de Ingreso" },
};

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
    status: "POSTED",
    notes: null,
    operationalDocTypeId: null,
    operationalDocType: null,
    referenceNumber: 6456,
    accountCode: null,
    createdById: "user-1",
    updatedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    journalEntryId: "je-1",
    journalEntry: JOURNAL_ENTRY,
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

describe("payment-form journal entry reference — voucher type + number + date (link)", () => {
  it("renders the voucher type, number and date as a link to the journal entry", async () => {
    renderForm();

    const link = await screen.findByRole("link", {
      name: /Comprobante de Ingreso/,
    });
    expect(link).toHaveAttribute(
      "href",
      "/test-org/accounting/journal/je-1",
    );
    expect(link).toHaveTextContent("Comprobante de Ingreso N° 3");
    expect(link).toHaveTextContent("23/05/2026");
  });

  it("still keeps the 'Asiento Contable:' label", async () => {
    renderForm();
    expect(await screen.findByText(/Asiento Contable:/)).toBeInTheDocument();
  });

  it("does not render the reference for a non-POSTED payment", async () => {
    renderForm(makeEditPayment({ status: "DRAFT", journalEntry: null }));
    await screen.findByText(/Asignación a/);
    expect(screen.queryByText(/Asiento Contable/)).toBeNull();
  });
});
