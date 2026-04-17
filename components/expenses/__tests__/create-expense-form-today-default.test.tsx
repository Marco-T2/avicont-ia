/**
 * RED → GREEN
 *
 * C-1 fix — create-expense-form.tsx date default uses todayLocal(),
 * NOT new Date().toISOString().split("T")[0] (UTC-based).
 *
 * Regression case: at 21:00 Bolivia time (UTC-4), UTC is already 01:00 next day.
 * The old code would default to "2026-04-18"; the new code must default to "2026-04-17".
 *
 * TZ=America/La_Paz is set globally in vitest.config.ts.
 */

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import CreateExpenseForm from "../create-expense-form";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ── Helpers ──

function openDialog() {
  render(<CreateExpenseForm orgSlug="test-org" lotId="lot-1" />);
  fireEvent.click(screen.getByRole("button", { name: /registrar gasto/i }));
  return document.querySelectorAll<HTMLInputElement>('input[type="date"]');
}

// ── Tests ──

describe("CreateExpenseForm — date default (C-1)", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("C-1.a — at 21:00 BO (UTC next day) default date is LOCAL today, not UTC tomorrow", () => {
    // 2026-04-17 21:00 BO (UTC-4) = 2026-04-18 01:00:00 UTC
    vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"));

    const dateInputs = openDialog();
    expect(dateInputs).toHaveLength(1);
    // Must be local today (Apr 17), NOT UTC tomorrow (Apr 18)
    expect(dateInputs[0].value).toBe("2026-04-17");
  });

  it("C-1.b — at 15:00 BO (well before UTC midnight) default date is correct", () => {
    // 2026-04-17 15:00 BO (UTC-4) = 2026-04-17 19:00:00 UTC
    vi.setSystemTime(new Date("2026-04-17T19:00:00.000Z"));

    const dateInputs = openDialog();
    expect(dateInputs).toHaveLength(1);
    expect(dateInputs[0].value).toBe("2026-04-17");
  });
});
