/**
 * RED → GREEN
 *
 * W-2 fix — journal-entry-form.tsx and create-journal-entry-form.tsx
 * date defaults use todayLocal(), NOT new Date().toISOString().split("T")[0].
 *
 * Regression case: at 21:00 Bolivia time (UTC-4), UTC is already 01:00 next day.
 * The old code would default to "2026-04-18"; the new code must default to "2026-04-17".
 *
 * TZ=America/La_Paz is set globally in vitest.config.ts.
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import JournalEntryForm from "../journal-entry-form";
import CreateJournalEntryForm from "../create-journal-entry-form";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/accounting/journal-line-row", () => ({
  default: () => null,
}));

// ── Fixtures ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_PERIOD = {
  id: "period-1",
  name: "Abril 2026",
  startDate: new Date("2026-04-01"),
  endDate: new Date("2026-04-30"),
  status: "OPEN" as const,
  organizationId: "org-1",
  year: 2026,
  createdById: "user-1",
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_VOUCHER_TYPE = {
  id: "vt-1",
  code: "CE" as const,
  name: "Egreso",
  description: null,
  isActive: true,
  organizationId: "org-1",
} as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASE_ACCOUNT = {
  id: "acc-1",
  code: "1.1.1",
  name: "Caja",
  type: "ACTIVO" as const,
  nature: "DEUDORA" as const,
  subtype: null,
  isDetail: true,
  requiresContact: false,
  isActive: true,
  organizationId: "org-1",
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  description: null,
} as any;

function renderNewJournalEntryForm() {
  return render(
    <JournalEntryForm
      orgSlug="test-org"
      accounts={[BASE_ACCOUNT]}
      periods={[BASE_PERIOD]}
      voucherTypes={[BASE_VOUCHER_TYPE]}
      editEntry={undefined}
    />,
  );
}

function renderCreateJournalEntryForm() {
  return render(
    <CreateJournalEntryForm
      orgSlug="test-org"
      accounts={[BASE_ACCOUNT]}
      onCancel={vi.fn()}
      onCreated={vi.fn()}
    />,
  );
}

// ── Tests — JournalEntryForm ──

describe("JournalEntryForm — new record default date (W-2)", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("W-2.a — at 21:00 BO (UTC next day) default date is LOCAL today, not UTC tomorrow", () => {
    // 2026-04-17 21:00 BO (UTC-4) = 2026-04-18 01:00:00 UTC
    vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"));

    renderNewJournalEntryForm();

    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    // Must be local today (Apr 17), NOT UTC tomorrow (Apr 18)
    expect(dateInput.value).toBe("2026-04-17");
  });

  it("W-2.b — at 15:00 BO (well before UTC midnight) default date is correct", () => {
    vi.setSystemTime(new Date("2026-04-17T19:00:00.000Z"));

    renderNewJournalEntryForm();

    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    expect(dateInput.value).toBe("2026-04-17");
  });
});

// ── Tests — CreateJournalEntryForm ──

describe("CreateJournalEntryForm — new record default date (W-2)", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("W-2.c — at 21:00 BO (UTC next day) default date is LOCAL today, not UTC tomorrow", () => {
    // 2026-04-17 21:00 BO (UTC-4) = 2026-04-18 01:00:00 UTC
    vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"));

    renderCreateJournalEntryForm();

    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    // Must be local today (Apr 17), NOT UTC tomorrow (Apr 18)
    expect(dateInput.value).toBe("2026-04-17");
  });

  it("W-2.d — at 15:00 BO (well before UTC midnight) default date is correct", () => {
    vi.setSystemTime(new Date("2026-04-17T19:00:00.000Z"));

    renderCreateJournalEntryForm();

    const dateInput = screen.getByLabelText(/fecha/i) as HTMLInputElement;
    expect(dateInput.value).toBe("2026-04-17");
  });
});
