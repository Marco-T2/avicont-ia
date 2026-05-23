/**
 * Phase 7 (REQ-PAY-1, REQ-PAY-4, REQ-PAY-6) — dynamic allocation fields +
 * restante guard. This is the slice that FIXES the visible throw Marco hit.
 *
 * Contract under test (one-way data flow: lines → totals):
 *   - "Importe recibido" = budget (editable input).
 *   - Per-line "Aplicar": 0 ≤ Aplicar ≤ Saldo.
 *   - Checking a line: budget blank → Aplicar = Saldo; budget set → Aplicar =
 *     min(Saldo, Restante).
 *   - "Importe aplicado" = Σ Aplicar (derived, read-only).
 *   - "Restante" = Recibido − Aplicado (derived, read-only).
 *   - Restante < 0 → SAVE BLOCKED (aggregate client guard, mirror of the server
 *     invariant entity.ts:387; the server still throws as last defense).
 *
 * Scenarios:
 *   A — blank budget, check 1530 + 1232 → aplicado 2762, restante 0.
 *   B — budget 2000, check both → 1530 + 470 (partial), aplicado 2000,
 *       restante 0, second invoice saldo 762 unapplied.
 *   Marco's symptom — a credit line covers cash; removing it (uncheck) uncovers
 *       cash so Restante goes negative → SAVE BLOCKED (no PATCH sent, no server
 *       throw).
 *
 * RED before GREEN: pre-implementation there is no "Restante" field rendered and
 * canSubmit does not include the aggregate sum(cash) ≤ recibido guard, so the
 * restante assertions and the save-blocked-on-negative-restante assertion FAIL.
 *
 * Cross-ref:
 *   - sdd/pagos-cobros-fifo/spec — REQ-PAY-1 (Scenarios A/B/C/D), REQ-PAY-4
 *     (Scenarios I/J), REQ-PAY-6 (Scenario N auto-FIFO).
 *   - sdd/pagos-cobros-fifo/design §6 (dynamic fields, one-way, restante<0 guard).
 *   - discovery #3022 + bug-root-cause: edit dropped credit, restante went
 *     negative, server threw PaymentAllocationsExceedTotal — now blocked client-side.
 */
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
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

// ── Fetch mock: two pending invoices (FIFO order 21/05 then 21/06) + no credit ─

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

function mockFetch(opts?: { credit?: unknown[] }) {
  global.fetch = vi.fn(async (url: string) => {
    let payload: Record<string, unknown> = {};
    if (typeof url === "string" && url.includes("/pending-documents")) {
      payload = { documents: [INVOICE_A, INVOICE_B] };
    } else if (typeof url === "string" && url.includes("/credit-balance")) {
      payload = { creditBalance: 0 };
    } else if (typeof url === "string" && url.includes("/unapplied-payments")) {
      payload = { payments: opts?.credit ?? [] };
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

// Edit-mode fixture lets us pre-set a contact so the pending-docs fetch fires
// and the two invoice rows render without a manual contact-select interaction.
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

function getRecibidoInput(): HTMLInputElement {
  return screen.getByLabelText(/importe recibido/i) as HTMLInputElement;
}

// Reads the derived "Restante" value rendered by the form (testid-stable).
function getRestanteText(): string {
  return (screen.getByTestId("payment-restante").textContent ?? "").trim();
}

async function invoiceCheckboxes(): Promise<HTMLInputElement[]> {
  // Wait until both invoice rows are present, then return their row checkboxes.
  await screen.findByText(/VENTA A/);
  await screen.findByText(/VENTA B/);
  return screen.getAllByRole("checkbox") as HTMLInputElement[];
}

// Helper: numeric value of a money string like "Bs. 2.762,00" or "2762".
function moneyToNumber(s: string): number {
  const digits = s.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "");
  return parseFloat(digits.replace(",", "."));
}

describe("payment-form dynamic fields — Restante guard (REQ-PAY-1/4)", () => {
  it("Scenario A — blank budget: check 1530 + 1232 → aplicado 2762, restante 0", async () => {
    renderForm();
    const checks = await invoiceCheckboxes();

    // Budget blank: checking a line fills Aplicar = full Saldo.
    fireEvent.click(checks[0]); // invoice A → 1530
    fireEvent.click(checks[1]); // invoice B → 1232

    await waitFor(() => {
      // Aplicado = Σ Aplicar = 2762.
      const aplicado = screen.getAllByText(/2[.,]?762/).length;
      expect(aplicado).toBeGreaterThan(0);
    });

    // Restante = recibido(blank→resolved to aplicado) − aplicado = 0.
    expect(moneyToNumber(getRestanteText())).toBe(0);
  });

  it("Scenario B — budget 2000: check both → 1530 + 470 partial, aplicado 2000, restante 0, second saldo 762 unapplied", async () => {
    renderForm();
    const recibido = getRecibidoInput();
    fireEvent.change(recibido, { target: { value: "2000" } });

    const checks = await invoiceCheckboxes();
    fireEvent.click(checks[0]); // A → min(1530, 2000) = 1530, restante 470
    fireEvent.click(checks[1]); // B → min(1232, 470) = 470 (partial)

    // Second invoice's Aplicar input holds 470, NOT its full 1232 saldo
    // (budget-aware fill: min(saldo, restante)).
    const rowB = screen.getByText(/VENTA B/).closest("tr") as HTMLElement;
    await waitFor(() => {
      const aplicarB = within(rowB).getByRole("spinbutton") as HTMLInputElement;
      expect(parseFloat(aplicarB.value)).toBe(470);
    });

    // Restante must settle at exactly 0 (2000 − 1530 − 470).
    expect(moneyToNumber(getRestanteText())).toBe(0);
  });

  it("Marco's symptom — removing a credit line that covered cash drives Restante negative → SAVE BLOCKED (no PATCH sent)", async () => {
    // A credit source (an overpaid prior COBRO) is available with 1232 available.
    mockFetch({
      credit: [
        {
          id: "credit-src-1",
          description: "COBRO previo (saldo a favor)",
          date: "2026-05-10T12:00:00.000Z",
          amount: 1232,
          available: 1232,
        },
      ],
    });

    // Edit a POSTED COBRO so the "Guardar" path is the PATCH edit path.
    renderForm(makeEditPayment({ status: "POSTED", amount: 1530 }));

    const recibido = getRecibidoInput();
    // Cash budget 1530 covers invoice A; the 1232 credit was meant to cover B.
    fireEvent.change(recibido, { target: { value: "1530" } });

    // Apply 1530 to A and 1232 to B directly (deterministic — independent of the
    // check-fill ordering). B's 1232 will be covered by the credit, not cash.
    await invoiceCheckboxes();
    const rowA = screen.getByText(/VENTA A/).closest("tr") as HTMLElement;
    const rowB = screen.getByText(/VENTA B/).closest("tr") as HTMLElement;
    fireEvent.click(within(rowA).getByRole("checkbox"));
    fireEvent.click(within(rowB).getByRole("checkbox"));
    fireEvent.change(within(rowA).getByRole("spinbutton"), {
      target: { value: "1530" },
    });
    fireEvent.change(within(rowB).getByRole("spinbutton"), {
      target: { value: "1232" },
    });

    // Check the credit → it covers B's 1232 → cash demand = 1530 = recibido,
    // restante 0. Then UNCHECK it → uncovers 1232 of cash the budget cannot
    // satisfy → Restante goes negative (Marco's symptom).
    const creditCheckbox = await screen.findByLabelText(/usar este saldo a favor/i);
    fireEvent.click(creditCheckbox); // check the credit → restante 0
    await waitFor(() => {
      expect(moneyToNumber(getRestanteText())).toBe(0);
    });
    fireEvent.click(creditCheckbox); // uncheck → uncovers the cash

    await waitFor(() => {
      expect(moneyToNumber(getRestanteText())).toBeLessThan(0);
    });

    // The save button must be disabled and an error message shown.
    const saveBtn = screen.getByRole("button", { name: /^guardar$/i });
    expect(saveBtn).toBeDisabled();
    expect(
      screen.getByText(/restante.*negativ|excede|sobreasign|supera el importe/i),
    ).toBeInTheDocument();

    // Click anyway — no PATCH must fire (server throw never reached).
    fireEvent.click(saveBtn);
    await waitFor(() => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const patchCalls = fetchMock.mock.calls.filter(
        (c) => c[1]?.method === "PATCH",
      );
      expect(patchCalls.length).toBe(0);
    });
  });
});
