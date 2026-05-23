/**
 * Visualization change — allocations table adopts the "Libro Mayor de cuentas"
 * column layout.
 *
 * Before: a single "Descripción" column rendering the CxC glosa (e.g. "VENTA A")
 *   with a "Vence:" sub-line.
 * After: Libro-Mayor-style columns "Fecha | Tipo | Nro Ref", where
 *   - Fecha   = formatDateBO(sourceDate)
 *   - Tipo    = sourceTypeCode (doc code: VG / ND / BC), font-mono uppercase
 *   - Nro Ref = `${sourceTypeCode}-${referenceNumber}` (e.g. "VG-1")
 *   with the "Vence:" sub-line moved under Nro Ref. The full glosa is dropped —
 *   Tipo + Nro Ref already identify the document. Total/Pagado/Saldo/Aplicar are
 *   untouched.
 *
 * RED (pre-implementation) — expected failure mode:
 *   - getByRole("columnheader", { name: "Tipo" }) THROWS — no such header yet
 *     (current header is the single "Descripción").
 *   - getByText("VG-1") THROWS — current render shows the glosa "VENTA A", there
 *     is no reference token rendered.
 *   - queryByText(/VENTA A/) expected null but is PRESENT — the glosa is still
 *     rendered by the current single-column layout.
 *
 * Cross-ref: mirrors components/accounting/ledger-page-client.tsx column model
 * (Fecha / Tipo[voucherCode] / Nº[entryNumber]) and reuses formatDateBO.
 */
import {
  render,
  screen,
  cleanup,
  within,
} from "@testing-library/react";
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

// Two pending invoices: VG-1 (due 21/05) then VG-2 (due 21/06), no credit.
const INVOICE_A = {
  id: "ar-A",
  type: "receivable" as const,
  description: "VENTA A",
  amount: 1530,
  paid: 0,
  balance: 1530,
  sourceType: "sale",
  sourceId: "s-A",
  sourceTypeCode: "VG",
  referenceNumber: 1,
  sourceDate: "2026-05-01T12:00:00.000Z",
  dueDate: "2026-05-21T12:00:00.000Z",
};
const INVOICE_B = {
  id: "ar-B",
  type: "receivable" as const,
  description: "VENTA B",
  amount: 1232,
  paid: 0,
  balance: 1232,
  sourceType: "sale",
  sourceId: "s-B",
  sourceTypeCode: "VG",
  referenceNumber: 2,
  sourceDate: "2026-05-02T12:00:00.000Z",
  dueDate: "2026-06-21T12:00:00.000Z",
};

function mockFetch() {
  global.fetch = vi.fn(async (url: string) => {
    let payload: Record<string, unknown> = {};
    if (typeof url === "string" && url.includes("/pending-documents")) {
      payload = { documents: [INVOICE_A, INVOICE_B] };
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
}

beforeEach(() => mockFetch());

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
    method: "EFECTIVO",
    amount: 0,
    description: "COBRO EFECTIVO: Marco",
    date: new Date("2026-05-22"),
    status: "DRAFT",
    notes: null,
    operationalDocTypeId: null,
    referenceNumber: null,
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

describe("payment-form allocations table — Libro Mayor column layout", () => {
  it("renders Fecha / Tipo / Nro Ref column headers (drops the single Descripción column)", async () => {
    renderForm();
    // Wait for the pending docs to load (row A's reference token appears).
    await screen.findByText("VG-1");

    expect(
      screen.getByRole("columnheader", { name: "Fecha" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Tipo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Nro Ref" }),
    ).toBeInTheDocument();
    // The allocations table no longer has a "Descripción" header.
    expect(
      screen.queryByRole("columnheader", { name: "Descripción" }),
    ).toBeNull();
  });

  it("each row shows the doc code (Tipo) + reference token and no longer the full glosa", async () => {
    renderForm();
    const rowA = (await screen.findByText("VG-1")).closest("tr") as HTMLElement;
    const rowB = screen.getByText("VG-2").closest("tr") as HTMLElement;

    // Tipo code rendered per row.
    expect(within(rowA).getByText("VG")).toBeInTheDocument();
    expect(within(rowB).getByText("VG")).toBeInTheDocument();

    // The full CxC glosa is gone from the allocations table.
    expect(screen.queryByText(/VENTA A/)).toBeNull();
    expect(screen.queryByText(/VENTA B/)).toBeNull();
  });

  it("keeps the Vence sub-line and renders the Fecha (sourceDate) per row", async () => {
    renderForm();
    const rowA = (await screen.findByText("VG-1")).closest("tr") as HTMLElement;

    expect(within(rowA).getByText(/Vence:/)).toBeInTheDocument();
    // Both Fecha (sourceDate) and Vence render as dd/mm/yyyy strings.
    expect(
      within(rowA).getAllByText(/\d{2}\/\d{2}\/\d{4}/).length,
    ).toBeGreaterThanOrEqual(1);
  });
});
