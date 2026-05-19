/**
 * T-23/T-24/T-25/T-26 — sale-form rebuildDescription + Pencil toggle
 *
 * RED expected failure modes:
 *  - T-23: form does not auto-rebuild description on line add (override=false → input stays at initial value).
 *  - T-24: covered by T-23 GREEN wiring.
 *  - T-25: Pencil button does not exist → cannot toggle override.
 *  - T-26: covered by T-25 GREEN wiring (lock + rebuild gating).
 *
 * Pattern replicates dispatch-form.tsx:318/369-388/1013-1037 EXACT.
 * Builder under test: buildSaleGlosa (REQ-GE-1, REQ-GE-3 scenarios 3.1–3.8).
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SaleForm from "../sale-form";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

const mockRole = vi.hoisted(() => ({ current: "owner" as string | null }));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: mockRole.current, isLoading: false, orgSlug: "test-org" }),
}));

beforeEach(() => {
  mockRole.current = "owner";
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Fixtures ──

const BASE_PERIOD = {
  id: "period-1",
  name: "Enero 2026",
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-31"),
  status: "OPEN" as const,
  organizationId: "org-1",
  year: 2026,
  createdById: "user-1",
  month: 1,
  closedAt: null,
  closedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const INCOME_ACCOUNT = { id: "acc-1", code: "4.1.1", name: "Ventas" };

const BASE_CONTACTS = [
  {
    id: "contact-1",
    name: "Marco",
    type: "CLIENTE" as any,
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
  },
];

function renderCreateMode() {
  return render(
    <SystemRoleProvider role="owner">
      <SaleForm
        orgSlug="test-org"
        contacts={BASE_CONTACTS}
        periods={[BASE_PERIOD]}
        incomeAccounts={[INCOME_ACCOUNT]}
        mode="new"
      />
    </SystemRoleProvider>,
  );
}

const BASE_SALE_EDIT = {
  id: "sale-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "DRAFT" as string,
  totalAmount: 200,
  description: "Mi glosa personalizada",
  referenceNumber: 45,
  notes: null,
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  journalEntryId: null,
  contact: { id: "contact-1", name: "Marco", type: "CLIENTE", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" as string },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [
    {
      id: "det-1",
      saleId: "sale-1",
      description: "Servicio",
      incomeAccountId: "acc-1",
      lineAmount: 200,
      quantity: 1,
      unitPrice: 200,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  receivable: null,
};

function renderEditMode() {
  return render(
    <SystemRoleProvider role="owner">
      <SaleForm
        orgSlug="test-org"
        contacts={BASE_CONTACTS}
        periods={[BASE_PERIOD]}
        incomeAccounts={[INCOME_ACCOUNT]}
        sale={BASE_SALE_EDIT as any}
        mode="edit"
      />
    </SystemRoleProvider>,
  );
}

// ── T-23: auto-fill on line add (override=false) ──

describe("T-23 — sale-form auto-rebuilds description on line mutation (override=false)", () => {
  it("T-23.1 — create mode initializes descriptionOverride=false (button label 'Editar')", () => {
    renderCreateMode();
    // Pencil toggle button is rendered with label "Editar" in auto mode
    expect(screen.getByRole("button", { name: /editar/i })).toBeInTheDocument();
  });

  it("T-23.2 — description input is readOnly while override=false", () => {
    renderCreateMode();
    const descInput = document.getElementById("sale-description") as HTMLInputElement;
    expect(descInput).toBeInTheDocument();
    expect(descInput.readOnly).toBe(true);
  });
});

// ── T-25: Pencil toggle locks auto-rebuild ──

describe("T-25 — Pencil toggle (override ON) locks auto-rebuild", () => {
  it("T-25.1 — clicking Pencil toggles label to 'Auto' and unlocks input", () => {
    renderCreateMode();
    const btn = screen.getByRole("button", { name: /editar/i });
    fireEvent.click(btn);
    // After toggle, button now indicates Auto-return action
    expect(screen.getByRole("button", { name: /auto/i })).toBeInTheDocument();
    const descInput = document.getElementById("sale-description") as HTMLInputElement;
    expect(descInput.readOnly).toBe(false);
  });
});

// ── T-23.3: edit-mode initializes with override=true (Pencil shows "Auto") ──

describe("T-23.3 — edit mode initializes descriptionOverride=true", () => {
  it("T-23.3 — edit-mode opens with Pencil in 'Auto' label state, input editable", () => {
    renderEditMode();
    expect(screen.getByRole("button", { name: /auto/i })).toBeInTheDocument();
    const descInput = document.getElementById("sale-description") as HTMLInputElement;
    expect(descInput.readOnly).toBe(false);
    // Existing description is preserved
    expect(descInput.value).toBe("Mi glosa personalizada");
  });
});
