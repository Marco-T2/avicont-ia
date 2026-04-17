/**
 * T5.1 RED → T5.2 GREEN: NDD variant — Notas shares bottom-row with Resumen
 * T5.3 RED → T5.4 GREEN: BC variant — same layout
 * T5.5 RED → T5.6 GREEN: Resumen right-aligned (ml-auto, no table) in both
 * T5.7 RED → T5.8 GREEN: responsive collapse classes on bottom-row
 *
 * REQ-B.1 / REQ-B.2 / REQ-B.3
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import DispatchForm from "../dispatch-form";

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
  amount: 500,
  paid: 200,
  balance: 300,
  status: "OPEN",
  allocations: [
    {
      id: "alloc-1",
      paymentId: "pay-1",
      amount: 200,
      payment: {
        id: "pay-1",
        date: "2026-01-20T00:00:00.000Z",
        description: "Pago parcial",
      },
    },
  ],
};

const BASE_DETAIL = {
  id: "det-1",
  productTypeId: "pt-1",
  productType: { id: "pt-1", name: "Pollo", code: "PLO" },
  detailNote: null,
  description: "Pollo",
  boxes: 10,
  grossWeight: 200,
  tare: 20,
  netWeight: 180,
  unitPrice: 5,
  shrinkage: null,
  shortage: null,
  realNetWeight: null,
  lineAmount: 900,
  order: 0,
};

const BASE_NDD_DISPATCH = {
  id: "dispatch-1",
  dispatchType: "NOTA_DESPACHO" as const,
  status: "POSTED" as const,
  sequenceNumber: 1,
  referenceNumber: null,
  displayCode: "ND-001",
  date: "2026-01-15T00:00:00.000Z",
  contactId: "contact-1",
  periodId: "period-1",
  description: "Despacho de prueba",
  notes: "Notas de prueba",
  totalAmount: 900,
  farmOrigin: null,
  chickenCount: null,
  shrinkagePct: null,
  contact: { id: "contact-1", name: "Cliente SA" },
  details: [BASE_DETAIL],
  receivable: BASE_RECEIVABLE,
};

const BASE_BC_DISPATCH = {
  ...BASE_NDD_DISPATCH,
  id: "dispatch-2",
  dispatchType: "BOLETA_CERRADA" as const,
  displayCode: "BC-001",
  farmOrigin: "Granja Norte",
  chickenCount: 500,
  shrinkagePct: 2,
  details: [
    {
      ...BASE_DETAIL,
      shrinkage: 3.6,
      shortage: 0,
      realNetWeight: 176.4,
      lineAmount: 882,
    },
  ],
};

const PRODUCT_TYPE = { id: "pt-1", name: "Pollo", code: "PLO" };

function renderNDD(patch: Partial<typeof BASE_NDD_DISPATCH> = {}) {
  const dispatch = { ...BASE_NDD_DISPATCH, ...patch };
  return render(
    <DispatchForm
      orgSlug="test-org"
      dispatchType="NOTA_DESPACHO"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[PRODUCT_TYPE]}
      roundingThreshold={0.5}
      existingDispatch={dispatch as any}
    />,
  );
}

function renderBC(patch: Partial<typeof BASE_BC_DISPATCH> = {}) {
  const dispatch = { ...BASE_BC_DISPATCH, ...patch };
  return render(
    <DispatchForm
      orgSlug="test-org"
      dispatchType="BOLETA_CERRADA"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[PRODUCT_TYPE]}
      roundingThreshold={0.5}
      existingDispatch={dispatch as any}
    />,
  );
}

// ── T5.1/T5.2: NDD — Notas shares bottom-row with Resumen ──

describe("DispatchForm NDD — Notas bottom-row layout (T5.1/T5.2 REQ-B.1)", () => {
  it("B.1.1 — Notas textarea is inside bottom-row-dispatch grid container", () => {
    const { container } = renderNDD();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    expect(bottomRow).toBeInTheDocument();
    const notesTextarea = container.querySelector("#dispatch-notes");
    expect(notesTextarea).toBeInTheDocument();
    expect(bottomRow).toContainElement(notesTextarea as HTMLElement);
  });

  it("B.1.2 — Resumen de Cobros heading is inside the same bottom-row-dispatch container (NDD)", () => {
    const { container } = renderNDD();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    const resumenHeading = screen.getByText("Resumen de Cobros");
    expect(bottomRow).toContainElement(resumenHeading);
  });
});

// ── T5.3/T5.4: BC — same layout ──

describe("DispatchForm BC — Notas bottom-row layout (T5.3/T5.4 REQ-B.2)", () => {
  it("B.2.1 — Notas textarea is inside bottom-row-dispatch grid container (BC)", () => {
    const { container } = renderBC();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    expect(bottomRow).toBeInTheDocument();
    const notesTextarea = container.querySelector("#dispatch-notes");
    expect(notesTextarea).toBeInTheDocument();
    expect(bottomRow).toContainElement(notesTextarea as HTMLElement);
  });

  it("B.2.2 — Resumen de Cobros heading is inside bottom-row-dispatch (BC)", () => {
    const { container } = renderBC();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    const resumenHeading = screen.getByText("Resumen de Cobros");
    expect(bottomRow).toContainElement(resumenHeading);
  });

  it("B.2.3 — no receivable: bottom-row still renders, right slot is empty (BC)", () => {
    const { container } = renderBC({ receivable: undefined, status: "DRAFT" as any });
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    expect(bottomRow).toBeInTheDocument();
    const notesTextarea = container.querySelector("#dispatch-notes");
    expect(notesTextarea).toBeInTheDocument();
    expect(bottomRow).toContainElement(notesTextarea as HTMLElement);
    expect(screen.queryByText("Resumen de Cobros")).not.toBeInTheDocument();
  });
});

// ── T5.5/T5.6: Resumen right-aligned (ml-auto, no table) ──

describe("DispatchForm — Resumen right-aligned, no table (T5.5/T5.6 REQ-B.3)", () => {
  it("B.3.1 — Resumen payment block has ml-auto class (right-aligned) in NDD", () => {
    const { container } = renderNDD();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    const mlAutoEl = bottomRow?.querySelector(".ml-auto");
    expect(mlAutoEl).toBeInTheDocument();
  });

  it("B.3.2 — Resumen does NOT use a <table> element in NDD", () => {
    const { container } = renderNDD();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    const table = bottomRow?.querySelector("table");
    expect(table).toBeNull();
  });

  it("B.3.3 — Resumen payment block has ml-auto class (right-aligned) in BC", () => {
    const { container } = renderBC();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    const mlAutoEl = bottomRow?.querySelector(".ml-auto");
    expect(mlAutoEl).toBeInTheDocument();
  });

  it("B.3.4 — Resumen does NOT use a <table> element in BC", () => {
    const { container } = renderBC();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    const table = bottomRow?.querySelector("table");
    expect(table).toBeNull();
  });
});

// ── T5.7/T5.8: Responsive collapse classes ──

describe("DispatchForm — bottom-row mobile collapse (T5.7/T5.8 REQ-B.1/B.2)", () => {
  it("B.1.7 — bottom-row-dispatch has grid-cols-1 (single-col on mobile) NDD", () => {
    const { container } = renderNDD();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    expect(bottomRow!.className).toContain("grid-cols-1");
  });

  it("B.1.8 — bottom-row-dispatch has sm:grid-cols-2 (2-col on sm+) NDD", () => {
    const { container } = renderNDD();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    expect(bottomRow!.className).toContain("sm:grid-cols-2");
  });

  it("B.2.7 — bottom-row-dispatch has grid-cols-1 (single-col on mobile) BC", () => {
    const { container } = renderBC();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    expect(bottomRow!.className).toContain("grid-cols-1");
  });

  it("B.2.8 — bottom-row-dispatch has sm:grid-cols-2 (2-col on sm+) BC", () => {
    const { container } = renderBC();
    const bottomRow = container.querySelector("[data-testid='bottom-row-dispatch']");
    expect(bottomRow!.className).toContain("sm:grid-cols-2");
  });
});
