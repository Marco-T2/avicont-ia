/**
 * sale-form description input — post-F4 simplificación.
 * descriptionOverride flag eliminado; el input es siempre editable (salvo
 * read-only por status), pero el próximo cambio de línea/contacto/referencia
 * rebuildea desde buildSaleGlosa. Tests verifican shape básico del input.
 */

import { render, screen, cleanup } from "@testing-library/react";
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

describe("sale-form description input (post-F4 simplificación)", () => {
  it("create mode: description input is editable (no readOnly, no Pencil toggle)", () => {
    renderCreateMode();
    const descInput = document.getElementById("sale-description") as HTMLInputElement;
    expect(descInput).toBeInTheDocument();
    expect(descInput.readOnly).toBe(false);
    // Pencil button removido — no debería existir
    expect(screen.queryByRole("button", { name: /editar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^auto$/i })).toBeNull();
  });

  it("edit DRAFT mode: input editable; rebuilds desde builder al mount (no preserva user-typed)", () => {
    renderEditMode();
    const descInput = document.getElementById("sale-description") as HTMLInputElement;
    expect(descInput.readOnly).toBe(false);
    // Marco lock post-archive: "no importa que se borre el dato que escribió
    // el usuario" — al editar, el builder rebuildea. Notas persiste manual.
    expect(descInput.value).toMatch(/^VENTA: /);
  });
});
