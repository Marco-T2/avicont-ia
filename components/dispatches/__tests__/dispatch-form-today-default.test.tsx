/**
 * T3.3 RED → T3.4 GREEN
 *
 * REQ-C.1 — dispatch-form.tsx default date uses todayLocal() (local-time getters),
 * NOT new Date().toISOString().split("T")[0] (UTC-based).
 *
 * Regression case: at 21:00 Bolivia time (UTC-4), UTC is already 01:00 next day.
 * The old code would show "2026-04-18"; the new code must show "2026-04-17".
 *
 * TZ=America/La_Paz is set globally in vitest.config.ts (PR0 / T0.1).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from "vitest";
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

const PRODUCT_TYPE = { id: "pt-1", name: "Pollo", code: "PLO" };

function renderNewDispatchForm() {
  return render(
    <DispatchForm
      orgSlug="test-org"
      dispatchType="NOTA_DESPACHO"
      contacts={[BASE_CONTACT]}
      periods={[BASE_PERIOD]}
      productTypes={[PRODUCT_TYPE]}
      roundingThreshold={0.5}
    />,
  );
}

// ── Tests ──

describe("DispatchForm — new record default date (REQ-C.1)", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("C.1 — at 21:00 BO (UTC next day) default date is LOCAL today, not UTC tomorrow", () => {
    // 2026-04-17 21:00 BO (UTC-4) = 2026-04-18 01:00:00 UTC
    vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"));

    renderNewDispatchForm();

    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    // Must be local today (Apr 17), NOT UTC tomorrow (Apr 18)
    expect(dateInput.value).toBe("2026-04-17");
  });

  it("C.1b — at 15:00 BO (well before UTC midnight) default date is correct", () => {
    // 2026-04-17 15:00 BO (UTC-4) = 2026-04-17 19:00:00 UTC
    vi.setSystemTime(new Date("2026-04-17T19:00:00.000Z"));

    renderNewDispatchForm();

    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    expect(dateInput.value).toBe("2026-04-17");
  });
});
