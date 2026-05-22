/**
 * payment-form description input — post-F4 simplificación.
 * descriptionOverride flag eliminado; el input es siempre editable (salvo
 * read-only por status), pero el próximo cambio de header/allocation rebuildea
 * desde buildPaymentGlosa. Tests verifican shape básico del input.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaymentForm from "../payment-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

// ── Mocks ──

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

// fetch mock — required because payment-form fires fetchPendingDocuments on
// contact set. Tests below do NOT set a contact in create-mode, so this is
// defensive only. Edit-mode fixtures bypass the fetch.
beforeEach(() => {
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ documents: [], creditBalance: 0, payments: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
});

// ── Fixtures ──

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
];

function renderCreateMode() {
  return render(
    <SystemRoleProvider role="owner">
      <PaymentForm
        orgSlug="test-org"
        contacts={BASE_CONTACTS}
        periods={[BASE_PERIOD]}
        defaultType="COBRO"
      />
    </SystemRoleProvider>,
  );
}

const BASE_PAYMENT_EDIT = {
  id: "pay-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  type: "COBRO",
  direction: "COBRO",
  method: "EFECTIVO",
  amount: 200,
  description: "Mi glosa de cobro",
  date: new Date("2026-05-19"),
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
};

function renderEditMode() {
  return render(
    <SystemRoleProvider role="owner">
      <PaymentForm
        orgSlug="test-org"
        contacts={BASE_CONTACTS}
        periods={[BASE_PERIOD]}
        existingPayment={BASE_PAYMENT_EDIT as any}
      />
    </SystemRoleProvider>,
  );
}

describe("payment-form description input (post-F4 simplificación)", () => {
  it("create mode: description input is editable (no readOnly, no Pencil toggle)", () => {
    renderCreateMode();
    const descInput = document.getElementById("payment-description") as HTMLInputElement;
    expect(descInput).toBeInTheDocument();
    expect(descInput.readOnly).toBe(false);
    expect(screen.queryByRole("button", { name: /editar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^auto$/i })).toBeNull();
  });

  it("edit DRAFT mode: input editable; rebuilds desde builder al mount (no preserva user-typed)", () => {
    renderEditMode();
    const descInput = document.getElementById("payment-description") as HTMLInputElement;
    expect(descInput.readOnly).toBe(false);
    // Marco lock post-archive: "no importa que se borre el dato que escribió
    // el usuario" — al editar, el builder rebuildea. Notas persiste manual.
    expect(descInput.value).toMatch(/^COBRO /);
  });

  it("edit mode con allocations serialized: no crashea cuando receivable dates llegan como strings (JSON server→client)", () => {
    // Regression: server-rendered Payment con .allocations[].receivable.*
    // dates llega serializado como strings ISO. El form crasheaba en
    // formatDateConditional (`date.getDate is not a function`) porque
    // los type casts `as Date` no convertían en runtime.
    const paymentWithSerializedDates = {
      ...BASE_PAYMENT_EDIT,
      allocations: [
        {
          id: "alloc-1",
          paymentId: "pay-1",
          receivableId: "ar-1",
          payableId: null,
          amount: 100,
          createdAt: new Date(),
          receivable: {
            id: "ar-1",
            description: "VENTA antigua",
            amount: 100,
            paid: 0,
            balance: 0,
            dueDate: "2026-06-19T00:00:00.000Z",
            sourceType: "sale",
            sourceId: "s-1",
            sourceTypeCode: "VG",
            referenceNumber: 42,
            createdAt: "2026-05-10T00:00:00.000Z",
          },
          payable: null,
        },
      ],
    };

    expect(() =>
      render(
        <SystemRoleProvider role="owner">
          <PaymentForm
            orgSlug="test-org"
            contacts={BASE_CONTACTS}
            periods={[BASE_PERIOD]}
            existingPayment={paymentWithSerializedDates as never}
          />
        </SystemRoleProvider>,
      ),
    ).not.toThrow();

    // Description rebuildeada con el token VG-42 (sourceDate fue parseada
    // correctamente desde el string ISO).
    const descInput = document.getElementById("payment-description") as HTMLInputElement;
    expect(descInput.value).toMatch(/VG-42/);
  });
});
