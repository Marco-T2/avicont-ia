/**
 * T6.1 RED → T6.2 GREEN: bottom-row grid wraps Notas + Resumen de Pagos
 * T6.3 RED → T6.4 GREEN: Resumen uses flex/justify-between/text-right (no table)
 *
 * REQ-A.5, REQ-A.6
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseForm from "../purchase-form";

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

vi.mock("@/components/iva-books/iva-book-purchase-modal", () => ({
  IvaBookPurchaseModal: () => null,
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
  month: 4,
  closedAt: null,
  closedBy: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const BASE_CONTACT = {
  id: "contact-1",
  name: "Proveedor SA",
  type: "PROVEEDOR" as const,
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

const BASE_PAYABLE = {
  id: "payable-1",
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

const BASE_PURCHASE: Record<string, unknown> = {
  id: "purchase-1",
  organizationId: "org-1",
  purchaseType: "COMPRA_GENERAL",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "POSTED",
  totalAmount: 113,
  description: "Compra de prueba",
  referenceNumber: null,
  notes: null,
  ruta: null,
  farmOrigin: null,
  chickenCount: null,
  shrinkagePct: null,
  totalGrossKg: null,
  totalNetKg: null,
  totalShrinkKg: null,
  totalShortageKg: null,
  totalRealNetKg: null,
  displayCode: "CG-001",
  createdById: "user-1",
  updatedById: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  journalEntryId: null,
  ivaPurchaseBook: null,
  contact: { id: "contact-1", name: "Proveedor SA", type: "PROVEEDOR", nit: "12345", paymentTermsDays: 30 },
  period: { id: "period-1", name: "Enero 2026", status: "OPEN" },
  createdBy: { id: "user-1", name: "Admin", email: "admin@test.com" },
  details: [
    {
      id: "det-1",
      purchaseId: "purchase-1",
      description: "Material",
      lineAmount: 113,
      quantity: 1,
      unitPrice: 113,
      order: 0,
      expenseAccountId: "acc-1",
      expenseAccountCode: "5.1.1",
      pricePerChicken: null,
      grossWeight: null,
      tare: null,
      netWeight: null,
      shrinkage: null,
      shortage: null,
      realNetWeight: null,
      productTypeId: null,
      detailNote: null,
      boxes: null,
      fecha: null,
      docRef: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  payable: null,
};

function renderForm(purchasePatch: Record<string, unknown> = {}, mode: "new" | "edit" = "edit") {
  const purchase = mode === "new" ? undefined : { ...BASE_PURCHASE, ...purchasePatch };
  return render(
    <PurchaseForm
      orgSlug="test-org"
      purchaseType="COMPRA_GENERAL"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[]}
      purchase={purchase as any}
      mode={mode}
    />,
  );
}

// ── T6.1/T6.2: bottom-row grid wraps Notas + Resumen de Pagos ──

describe("PurchaseForm — bottom-row grid layout (T6.1/T6.2 REQ-A.5)", () => {
  it("A.5.1 — data-testid=bottom-row exists in the DOM", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    expect(bottomRow).toBeInTheDocument();
  });

  it("A.5.2 — bottom-row has grid-cols-1 and sm:grid-cols-2", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    expect(bottomRow!.className).toContain("grid-cols-1");
    expect(bottomRow!.className).toContain("sm:grid-cols-2");
  });

  it("A.5.3 — Notas textarea (#purchase-notes) is a descendant of bottom-row", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const notesTextarea = container.querySelector("#purchase-notes");
    expect(notesTextarea).toBeInTheDocument();
    expect(bottomRow).toContainElement(notesTextarea as HTMLElement);
  });

  it("A.5.4 — Resumen de Pagos heading is inside bottom-row when payable is present and POSTED", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const resumenHeading = screen.getByText("Resumen de Pagos (CxP)");
    expect(bottomRow).toContainElement(resumenHeading);
  });

  it("A.5.5 — bottom-row is still present when payable is null (Notas left slot preserved)", () => {
    const { container } = renderForm({ status: "POSTED", payable: null });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    expect(bottomRow).toBeInTheDocument();
    const notesTextarea = container.querySelector("#purchase-notes");
    expect(bottomRow).toContainElement(notesTextarea as HTMLElement);
  });

  it("A.5.6 — Resumen de Pagos NOT rendered when payable is null", () => {
    renderForm({ status: "POSTED", payable: null });
    expect(screen.queryByText("Resumen de Pagos (CxP)")).not.toBeInTheDocument();
  });

  it("A.5.7 — DRAFT purchase: bottom-row still rendered (Notas always available)", () => {
    const { container } = renderForm({ status: "DRAFT", payable: null });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    expect(bottomRow).toBeInTheDocument();
    const notesTextarea = container.querySelector("#purchase-notes");
    expect(bottomRow).toContainElement(notesTextarea as HTMLElement);
  });
});

// ── T6.3/T6.4: Resumen uses flex/justify-between/text-right (no table) ──

describe("PurchaseForm — Resumen de Pagos right-aligned layout (T6.3/T6.4 REQ-A.6)", () => {
  it("A.6.1 — Resumen inner container has flex flex-col w-full", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const wFullEl = bottomRow?.querySelector(".w-full.flex-col");
    expect(wFullEl).toBeInTheDocument();
  });

  it("A.6.2 — at least 2 rows with justify-between (Total + Saldo or allocation)", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const justifyRows = bottomRow?.querySelectorAll(".justify-between");
    expect(justifyRows?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("A.6.3 — amount spans carry text-right class", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const textRightSpans = bottomRow?.querySelectorAll("span.text-right");
    expect(textRightSpans?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("A.6.4 — amount spans carry whitespace-nowrap class (no wrap in narrow column)", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const nowrapSpans = bottomRow?.querySelectorAll("span.whitespace-nowrap");
    expect(nowrapSpans?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("A.6.5 — NO <table> inside bottom-row (flex replaces table layout)", () => {
    const { container } = renderForm({ status: "POSTED", payable: BASE_PAYABLE });
    const bottomRow = container.querySelector("[data-testid='bottom-row']");
    const table = bottomRow?.querySelector("table");
    expect(table).toBeNull();
  });
});
