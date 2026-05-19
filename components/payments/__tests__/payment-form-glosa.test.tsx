/**
 * T-27 — payment-form rebuildDescription + Pencil toggle (REQ-GE-4)
 *
 * RED expected failure modes:
 *  - T-27.1/.2: Pencil button does not exist; current autoDescription useEffect
 *    only runs when description is empty.
 *  - T-27.3: edit-mode does not initialize override=true (Pencil missing).
 *
 * Pattern replicates dispatch-form.tsx EXACT (design D9).
 *
 * Deviation lock (surfaced honestly):
 *  The form preview calls buildPaymentGlosa with the data available at form
 *  level (method, contactName, total). The per-allocation tokens
 *  (sourceTypeCode/refNo/sourceDate) are NOT yet plumbed into the form because
 *  PendingDocument DTO does not expose them — service rebuild at post-time
 *  emits the canonical full glosa (REQ-GE-2 / Batch B Phase 5). Header-only
 *  preview matches REQ-GE-2 Scenario 2.4 (empty-allocations form) by design.
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
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
        userRole="owner"
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
        userRole="owner"
      />
    </SystemRoleProvider>,
  );
}

// ── T-27.1: create mode initializes descriptionOverride=false (Pencil label "Editar") ──

describe("T-27 — payment-form rebuildDescription + Pencil toggle", () => {
  it("T-27.1 — create mode initializes descriptionOverride=false (Pencil 'Editar')", () => {
    renderCreateMode();
    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
  });

  it("T-27.2 — description input is readOnly while override=false (create mode)", () => {
    renderCreateMode();
    const descInput = document.getElementById("payment-description") as HTMLInputElement;
    expect(descInput).toBeInTheDocument();
    expect(descInput.readOnly).toBe(true);
  });

  it("T-27.3 — edit mode initializes descriptionOverride=true (Pencil 'Auto', input editable, value preserved)", () => {
    renderEditMode();
    expect(screen.getByRole("button", { name: /auto/i })).toBeInTheDocument();
    const descInput = document.getElementById("payment-description") as HTMLInputElement;
    expect(descInput.readOnly).toBe(false);
    expect(descInput.value).toBe("Mi glosa de cobro");
  });

  it("T-27.4 — clicking Pencil in create mode toggles to 'Auto' label and unlocks input", () => {
    renderCreateMode();
    const btn = screen.getByRole("button", { name: /editar/i });
    fireEvent.click(btn);
    expect(screen.getByRole("button", { name: /auto/i })).toBeInTheDocument();
    const descInput = document.getElementById("payment-description") as HTMLInputElement;
    expect(descInput.readOnly).toBe(false);
  });
});
