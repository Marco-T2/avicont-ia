/**
 * Phase 4 (T-16..T-19) — PaymentForm `initialValues` prop (shortcut mode).
 *
 * RED → GREEN. The Server Component at /[orgSlug]/payments/new feeds these
 * pre-filled values when the user enters via the "registrar pago" shortcut
 * (`?type=COBRO&saleId=...` / `?type=PAGO&purchaseId=...`).
 *
 * Contract: see `modules/payment/application/types/shortcut-initial-values.ts`.
 *
 * Money math: amount comparison MUST use `new Decimal(...).gt(new Decimal(...))`
 * (DEC-1 enforced by sentinel test).
 *
 * NOTE: this file intentionally avoids `userEvent`. We use `fireEvent` to mirror
 * the rest of `components/**` test conventions.
 */

import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaymentForm from "../payment-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";
import type { ShortcutInitialValues } from "@/modules/payment/application/types/shortcut-initial-values";

afterEach(() => cleanup());

// ── Mocks ─────────────────────────────────────────────────────────────────────

const routerPush = vi.fn();
const routerRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: routerRefresh }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "owner", isLoading: false, orgSlug: "test-org" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// `fetchPendingDocuments` hits these endpoints on contactId change. In shortcut
// mode the form should NOT clobber the pre-seeded allocation row — but the
// effect still runs once. Mock fetch to return an empty list so the merge is
// a no-op (defensive: even if the merge ran, it would keep the seeded line).
beforeEach(() => {
  routerPush.mockReset();
  routerRefresh.mockReset();
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (url.includes("/pending-documents")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ documents: [] }),
        });
      }
      if (url.includes("/credit-balance")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ creditBalance: 0 }),
        });
      }
      if (url.includes("/unapplied-payments")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ payments: [] }),
        });
      }
      if (url.includes("/api/organizations/") && url.endsWith("/payments")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "pay-new-1" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

const SHORTCUT_CONTACT = {
  id: "cnt-1",
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

const SHORTCUT_INITIAL: ShortcutInitialValues = {
  type: "COBRO",
  contactId: "cnt-1",
  description: "Cobro Venta #42",
  sourceKind: "sale",
  sourceId: "sale-abc-123",
  voucherCode: "V-42",
  referenceNumber: "REF-001",
  allocationTargetId: "rcv-1",
  allocationBalance: 500,
};

function renderShortcutForm(overrides?: Partial<ShortcutInitialValues>) {
  return render(
    <SystemRoleProvider role="owner">
      <PaymentForm
        orgSlug="test-org"
        contacts={[SHORTCUT_CONTACT]}
        periods={[BASE_PERIOD]}
        existingPayment={undefined}
        initialValues={{ ...SHORTCUT_INITIAL, ...overrides }}
      />
    </SystemRoleProvider>,
  );
}

// ── T-16 — accepts initialValues + seeds state ────────────────────────────────

describe("PaymentForm — shortcut mode T-16: seeds state from initialValues", () => {
  it("T-16.a — amount input is seeded with allocationBalance", () => {
    renderShortcutForm();
    const amount = screen.getByLabelText(/importe recibido/i) as HTMLInputElement;
    expect(amount.value).toBe("500");
  });

  it("T-16.b — description input is rebuilt by builder en shortcut mode (post-F4 simplificación)", () => {
    renderShortcutForm();
    const desc = screen.getByLabelText(/^descripción$/i) as HTMLInputElement;
    // F4 lock: builder canónico siempre. El seed "Cobro Venta #42" de
    // initialValues queda sobreescrito por buildPaymentGlosa al mount.
    expect(desc.value).toMatch(/^COBRO /);
  });

  it("T-16.c — title reflects the locked payment type (COBRO → Nuevo Cobro)", () => {
    renderShortcutForm({ type: "COBRO" });
    expect(screen.getByText(/nuevo cobro/i)).toBeInTheDocument();
  });

  it("T-16.d — title reflects the locked payment type (PAGO → Nuevo Pago)", () => {
    renderShortcutForm({
      type: "PAGO",
      contactId: "prv-1",
      description: "Pago Compra #7",
      sourceKind: "purchase",
      voucherCode: "C-7",
    });
    expect(screen.getByText(/nuevo pago/i)).toBeInTheDocument();
  });
});

// ── T-17 — locked fields disabled when initialValues present ─────────────────

describe("PaymentForm — shortcut mode T-17: locked fields disabled", () => {
  it("T-17.a — contact selector is disabled", () => {
    renderShortcutForm();
    // Two comboboxes exist: operational-doc-type (id="operational-doc-type")
    // and the ContactSelector. Scope to the contact card region.
    const contactLabel = screen.getByText(/^Cliente$/);
    const card = contactLabel.closest("div.space-y-2") as HTMLElement;
    const combobox = within(card).getByRole("combobox");
    expect(combobox).toBeDisabled();
  });

  it("T-17.b — allocation row is pre-rendered with the allocationTargetId description and checked", async () => {
    renderShortcutForm();
    // The seeded allocation row should be visible WITHOUT waiting on the fetch:
    // the form pre-populates from initialValues synchronously.
    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(1);
    // The seeded allocation row's checkbox must be checked AND disabled
    // (allocation cannot be removed in shortcut mode).
    const seededCheckbox = checkboxes[0] as HTMLInputElement;
    expect(seededCheckbox.checked).toBe(true);
    expect(seededCheckbox).toBeDisabled();
  });
});

// ── T-18 — amount cannot exceed maxAmount ─────────────────────────────────────

describe("PaymentForm — shortcut mode T-18: amount capped at allocationBalance", () => {
  it("T-18.a — submit is blocked when amount > allocationBalance", async () => {
    renderShortcutForm({ allocationBalance: 500 });
    const amount = screen.getByLabelText(/importe recibido/i) as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "600" } });
    fireEvent.blur(amount);

    // Save Draft button — visible for owner role.
    const saveBtn = screen.getByRole("button", { name: /guardar borrador/i });
    fireEvent.click(saveBtn);

    // Wait briefly to see if a POST went through (it should NOT).
    await waitFor(() => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const postCalls = fetchMock.mock.calls.filter(
        (c) =>
          typeof c[0] === "string" &&
          c[0].endsWith("/payments") &&
          c[1]?.method === "POST",
      );
      // No POST should fire when amount > maxAmount.
      expect(postCalls.length).toBe(0);
    });
  });

  it("T-18.b — submit succeeds when amount == allocationBalance", async () => {
    renderShortcutForm({ allocationBalance: 500 });
    const amount = screen.getByLabelText(/importe recibido/i) as HTMLInputElement;
    // amount already seeded to 500 — confirm it submits.
    expect(amount.value).toBe("500");

    const saveBtn = screen.getByRole("button", { name: /guardar borrador/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
      const postCalls = fetchMock.mock.calls.filter(
        (c) =>
          typeof c[0] === "string" &&
          c[0].endsWith("/payments") &&
          c[1]?.method === "POST",
      );
      expect(postCalls.length).toBe(1);
    });
  });
});

// ── T-19 — returnTo honored on successful submit ─────────────────────────────

describe("PaymentForm — shortcut mode T-19: returnTo honored", () => {
  it("T-19.a — on successful submit, redirects to source page (sale)", async () => {
    renderShortcutForm({ sourceKind: "sale", sourceId: "sale-abc-123" });

    const saveBtn = screen.getByRole("button", { name: /guardar borrador/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/test-org/sales/sale-abc-123");
    });
  });

  it("T-19.b — on successful submit, redirects to source page (purchase)", async () => {
    renderShortcutForm({
      type: "PAGO",
      contactId: "cnt-1",
      sourceKind: "purchase",
      sourceId: "purch-xyz-789",
      voucherCode: "C-7",
      description: "Pago Compra #7",
    });

    const saveBtn = screen.getByRole("button", { name: /guardar borrador/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/test-org/purchases/purch-xyz-789");
    });
  });
});
