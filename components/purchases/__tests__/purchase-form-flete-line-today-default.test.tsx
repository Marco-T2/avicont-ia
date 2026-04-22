/**
 * RED → GREEN
 *
 * W-1 fix — purchase-form.tsx emptyFleteeLine() fecha uses todayLocal(),
 * NOT "" (empty string). Per design D.5, new flete detail lines must
 * prefill fecha with today's local date.
 *
 * Regression case: at 21:00 Bolivia time (UTC-4), UTC is already 01:00 next day.
 * The new line fecha must show "2026-04-17" (local today), not "" or "2026-04-18".
 *
 * TZ=America/La_Paz is set globally in vitest.config.ts.
 */

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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
  name: "Abril 2026",
  startDate: new Date("2026-04-01"),
  endDate: new Date("2026-04-30"),
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

const PRODUCT_TYPE = { id: "pt-1", name: "Pollo", code: "PLO" };

function renderFleteForm() {
  return render(
    <PurchaseForm
      orgSlug="test-org"
      purchaseType="FLETE"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[PRODUCT_TYPE]}
      purchase={undefined}
      mode="new"
    />,
  );
}

// ── Tests ──

describe("PurchaseForm FLETE — emptyFleteeLine fecha default (W-1)", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("W-1.a — initial flete line fecha is LOCAL today when at 21:00 BO (UTC next day)", () => {
    // 2026-04-17 21:00 BO (UTC-4) = 2026-04-18 01:00:00 UTC
    vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"));

    renderFleteForm();

    // The detail table renders date inputs for each flete line.
    // With one initial line, there are 2 date inputs: header + flete line fecha.
    const allDateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(allDateInputs.length).toBeGreaterThanOrEqual(2);
    const fleteLineFecha = allDateInputs[1];
    // Must be local today (Apr 17), NOT UTC tomorrow (Apr 18) or empty ""
    expect(fleteLineFecha.value).toBe("2026-04-17");
  });

  it("W-1.b — clicking 'Agregar línea' adds a new line with LOCAL today fecha", () => {
    // 2026-04-17 21:00 BO (UTC-4) = 2026-04-18 01:00:00 UTC
    vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"));

    renderFleteForm();

    fireEvent.click(screen.getByRole("button", { name: /agregar línea/i }));

    const allDateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    // Now 3 date inputs: header + 2 flete lines. Last one is the new line.
    expect(allDateInputs.length).toBeGreaterThanOrEqual(3);
    const newLineFecha = allDateInputs[allDateInputs.length - 1];
    expect(newLineFecha.value).toBe("2026-04-17");
  });

  it("W-1.c — at 15:00 BO (well before UTC midnight) flete line fecha is correct", () => {
    // 2026-04-17 15:00 BO (UTC-4) = 2026-04-17 19:00:00 UTC
    vi.setSystemTime(new Date("2026-04-17T19:00:00.000Z"));

    renderFleteForm();

    const allDateInputs = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
    expect(allDateInputs.length).toBeGreaterThanOrEqual(2);
    const fleteLineFecha = allDateInputs[1];
    expect(fleteLineFecha.value).toBe("2026-04-17");
  });
});
