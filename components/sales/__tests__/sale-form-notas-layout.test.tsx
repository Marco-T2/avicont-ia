/**
 * T4.1 RED → T4.2 GREEN: Notas renders inside bottom-row 2-col grid with Resumen
 * T4.3 RED → T4.4 GREEN: DRAFT state keeps half-width + empty right slot
 * T4.5 RED → T4.6 GREEN: Resumen payment rows wrapper right-aligned (ml-auto, no table)
 * T4.7 RED → T4.8 GREEN: responsive collapse classes present
 *
 * REQ-A.4 / REQ-A.5
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import SaleForm from "../sale-form";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "admin" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/iva-books/iva-book-sale-modal", () => ({
  IvaBookSaleModal: () => null,
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

const INCOME_ACCOUNT = { id: "acc-1", code: "4.1.1", name: "Ventas" };

const BASE_CONTACT = {
  id: "contact-1",
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

const BASE_RECEIVABLE = {
  id: "rec-1",
  amount: 113,
  balance: 50,
  allocations: [
    {
      id: "alloc-1",
      paymentId: "pay-1",
      amount: 63,
      payment: {
        date: "2026-01-20",
        description: "Pago parcial",
      },
    },
  ],
};

const BASE_SALE = {
  id: "sale-1",
  organizationId: "org-1",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "POSTED" as string,
  totalAmount: 113,
  description: "Venta de prueba",
  referenceNumber: null,
  notes: "Notas de prueba",
  displayCode: "CI-001",
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  journalEntryId: null,
  ivaSalesBook: null,
  contact: { id: "contact-1", name: "Cliente SA", type: "CLIENTE", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" as string },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [
    {
      id: "det-1",
      saleId: "sale-1",
      description: "Servicio",
      incomeAccountId: "acc-1",
      lineAmount: 113,
      quantity: 1,
      unitPrice: 113,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  receivable: BASE_RECEIVABLE,
};

function renderForm(salePatch: Partial<typeof BASE_SALE> = {}, mode: "new" | "edit" = "edit") {
  const sale = mode === "new" ? undefined : { ...BASE_SALE, ...salePatch };
  return render(
    <SaleForm
      orgSlug="test-org"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      incomeAccounts={[INCOME_ACCOUNT]}
      sale={sale as any}
      mode={mode}
    />,
  );
}

// ── T4.1/T4.2: Notas shares bottom row with Resumen de Cobros ──

describe("SaleForm — Notas bottom-row layout (T4.1/T4.2 REQ-A.4)", () => {
  it("A.4.1 — Notas textarea is inside bottom-row grid container (data-testid=bottom-row)", () => {
    const { container } = renderForm({ status: "POSTED", receivable: BASE_RECEIVABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    expect(bottomRow).toBeInTheDocument();
    const notesTextarea = container.querySelector("#sale-notes");
    expect(notesTextarea).toBeInTheDocument();
    // Notas must be a descendant of bottom-row
    expect(bottomRow).toContainElement(notesTextarea as HTMLElement);
  });

  it("A.4.2 — Resumen de Cobros Card is inside the same bottom-row container", () => {
    const { container } = renderForm({ status: "POSTED", receivable: BASE_RECEIVABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    // Resumen heading must be inside bottom-row
    const resumenHeading = screen.getByText("Resumen de Cobros (CxC)");
    expect(bottomRow).toContainElement(resumenHeading);
  });

  it("A.4.3 — Descripción input is NOT inside bottom-row (stays in its original position)", () => {
    const { container } = renderForm({ status: "POSTED", receivable: BASE_RECEIVABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const descInput = container.querySelector("#sale-description");
    expect(descInput).toBeInTheDocument();
    // Descripción must NOT be a descendant of bottom-row
    expect(bottomRow).not.toContainElement(descInput as HTMLElement);
  });
});

// ── T4.3/T4.4: DRAFT state — 2-col grid preserved, right slot empty ──

describe("SaleForm — DRAFT state bottom-row (T4.3/T4.4 REQ-A.4)", () => {
  it("A.4.4 — DRAFT sale: bottom-row still uses sm:grid-cols-2 (grid preserved)", () => {
    const { container } = renderForm({ status: "DRAFT", receivable: undefined });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    expect(bottomRow).toBeInTheDocument();
    // Must have both responsive grid classes
    expect(bottomRow!.className).toContain("grid-cols-1");
    expect(bottomRow!.className).toContain("sm:grid-cols-2");
  });

  it("A.4.5 — DRAFT sale: Notas still rendered in bottom-row left slot", () => {
    const { container } = renderForm({ status: "DRAFT", receivable: undefined });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const notesTextarea = container.querySelector("#sale-notes");
    expect(notesTextarea).toBeInTheDocument();
    expect(bottomRow).toContainElement(notesTextarea as HTMLElement);
  });

  it("A.4.6 — DRAFT sale: Resumen de Cobros Card NOT rendered", () => {
    renderForm({ status: "DRAFT", receivable: undefined });
    expect(screen.queryByText("Resumen de Cobros (CxC)")).not.toBeInTheDocument();
  });
});

// ── T4.5/T4.6: Resumen payment rows right-aligned, no table ──

describe("SaleForm — Resumen de Cobros right-aligned payments (T4.5/T4.6 REQ-A.5)", () => {
  it("A.5.1 — Resumen payment block has ml-auto class (right-aligned)", () => {
    const { container } = renderForm({ status: "POSTED", receivable: BASE_RECEIVABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    // Find the payment rows wrapper inside Resumen
    const mlAutoEl = bottomRow?.querySelector(".ml-auto");
    expect(mlAutoEl).toBeInTheDocument();
  });

  it("A.5.2 — Resumen does NOT use a <table> element", () => {
    const { container } = renderForm({ status: "POSTED", receivable: BASE_RECEIVABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const table = bottomRow?.querySelector("table");
    expect(table).toBeNull();
  });

  it("A.5.3 — payment allocation link is rendered (real allocation data shown)", () => {
    renderForm({ status: "POSTED", receivable: BASE_RECEIVABLE });
    // Allocation link must show the payment date
    const allocationText = screen.getByText(/cobro el/i);
    expect(allocationText).toBeInTheDocument();
  });
});

// ── T4.7/T4.8: Responsive collapse — grid-cols-1 + sm:grid-cols-2 ──

describe("SaleForm — bottom-row mobile collapse (T4.7/T4.8 REQ-A.4)", () => {
  it("A.4.7 — bottom-row has grid-cols-1 (single-col on mobile)", () => {
    const { container } = renderForm({ status: "POSTED", receivable: BASE_RECEIVABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    expect(bottomRow!.className).toContain("grid-cols-1");
  });

  it("A.4.8 — bottom-row has sm:grid-cols-2 (2-col on sm+ breakpoint)", () => {
    const { container } = renderForm({ status: "POSTED", receivable: BASE_RECEIVABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    expect(bottomRow!.className).toContain("sm:grid-cols-2");
  });
});
