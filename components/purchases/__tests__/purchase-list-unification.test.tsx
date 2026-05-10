/**
 * T7.1 RED → T7.2 GREEN: entry button unification (single "Compra / Servicio" card)
 * T7.3 RED → T7.4 GREEN: filter unification (COMPRA_GENERAL_O_SERVICIO)
 *
 * REQ-C.1, REQ-C.2
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import PurchaseList from "../purchase-list";

afterEach(() => cleanup());

// ── jsdom shims for Radix UI ──
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
window.Element.prototype.releasePointerCapture = vi.fn();
window.Element.prototype.setPointerCapture = vi.fn();

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Fixtures ──

const BASE_PURCHASE = {
  id: "purchase-1",
  organizationId: "org-1",
  purchaseType: "COMPRA_GENERAL",
  periodId: "period-1",
  contactId: "contact-1",
  date: new Date("2026-01-15"),
  status: "POSTED",
  totalAmount: 100,
  description: "Compra general",
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
  details: [],
  payable: null,
};

const SERVICIO_PURCHASE = {
  ...BASE_PURCHASE,
  id: "purchase-2",
  purchaseType: "SERVICIO",
  displayCode: "SV-001",
  description: "Servicio contratado",
};

// ── T7.1/T7.2: Entry button unification ──

describe("PurchaseList — unified entry button (T7.1/T7.2 REQ-C.1)", () => {
  it("C.1.1 — exactly ONE button/link labelled 'Nueva Compra / Servicio' is rendered", () => {
    render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    const unifiedLinks = screen.getAllByRole("link", { name: /nueva compra \/ servicio/i });
    expect(unifiedLinks).toHaveLength(1);
  });

  it("C.1.2 — NO button/link with text 'Compra General' standalone entry", () => {
    render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    // The entry card titles should not have a standalone 'Compra General' card
    const compraGeneralCards = screen.queryAllByText(/^compra general$/i);
    expect(compraGeneralCards).toHaveLength(0);
  });

  it("C.1.3 — NO button/link with text 'Servicio' standalone entry card title", () => {
    render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    // There should be no standalone 'Servicio' entry card title
    const servicioCards = screen.queryAllByText(/^servicio$/i);
    expect(servicioCards).toHaveLength(0);
  });

  it("C.1.4 — unified button href contains type=COMPRA_GENERAL", () => {
    render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    const unifiedLink = screen.getByRole("link", { name: /nueva compra \/ servicio/i });
    expect(unifiedLink).toHaveAttribute("href", expect.stringContaining("type=COMPRA_GENERAL"));
  });

  it("C.1.5 — historical SV-xxx (SERVICIO) rows still render in the list", () => {
    render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any, SERVICIO_PURCHASE as any]} total={2} page={1} pageSize={25} totalPages={1} />);
    const svRow = screen.getByText("SV-001");
    expect(svRow).toBeInTheDocument();
  });
});

// ── T7.3/T7.4: Filter unification ──

describe("PurchaseList — filter unification (T7.3/T7.4 REQ-C.2)", () => {
  it("C.2.1 — filter dropdown has item 'Compras y Servicios' covering both types", () => {
    const { container } = render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    // Open the Tipo select trigger (first select in the page)
    const typeTrigger = container.querySelector("[data-slot='select-trigger']") as HTMLElement;
    fireEvent.pointerDown(typeTrigger, { button: 0, ctrlKey: false });
    fireEvent.click(typeTrigger);
    const comprasYServiciosOption = screen.getByRole("option", { name: /compras y servicios/i });
    expect(comprasYServiciosOption).toBeInTheDocument();
  });

  it("C.2.2 — NO separate filter item 'Compra General' in the type select", () => {
    const { container } = render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    const typeTrigger = container.querySelector("[data-slot='select-trigger']") as HTMLElement;
    fireEvent.pointerDown(typeTrigger, { button: 0, ctrlKey: false });
    fireEvent.click(typeTrigger);
    const compraGeneralOption = screen.queryByRole("option", { name: /^compra general$/i });
    expect(compraGeneralOption).not.toBeInTheDocument();
  });

  it("C.2.3 — NO separate filter item 'Servicio' in the type select", () => {
    const { container } = render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    const typeTrigger = container.querySelector("[data-slot='select-trigger']") as HTMLElement;
    fireEvent.pointerDown(typeTrigger, { button: 0, ctrlKey: false });
    fireEvent.click(typeTrigger);
    const servicioOption = screen.queryByRole("option", { name: /^servicio$/i });
    expect(servicioOption).not.toBeInTheDocument();
  });

  it("C.2.4 — PURCHASE_TYPE_LABEL maps COMPRA_GENERAL to 'Compra / Servicio' in the table", () => {
    render(<PurchaseList orgSlug="test-org" items={[BASE_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    // Row type column shows merged label
    const typeCells = screen.getAllByText("Compra / Servicio");
    expect(typeCells.length).toBeGreaterThanOrEqual(1);
  });

  it("C.2.5 — PURCHASE_TYPE_LABEL maps SERVICIO to 'Compra / Servicio' in the table (legacy rows)", () => {
    render(<PurchaseList orgSlug="test-org" items={[SERVICIO_PURCHASE as any]} total={1} page={1} pageSize={25} totalPages={1} />);
    const typeCells = screen.getAllByText("Compra / Servicio");
    expect(typeCells.length).toBeGreaterThanOrEqual(1);
  });
});
