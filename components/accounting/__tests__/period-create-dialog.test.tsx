/**
 * TDD suite for PeriodCreateDialog — UX enhancements
 * Change: fiscal-period-form-ux
 *
 * Strict TDD: RED tests are committed first, GREEN implementation follows.
 *
 * UX-T01 — placeholder + microcopia (REQ-1)
 * UX-T02 — month select autocompletes startDate/endDate (REQ-2)
 * UX-T03 — month select autocompletes name (REQ-2)
 * UX-T04 — manual date edit wins over autocomplete (REQ-2)
 * UX-T05 — cross-month warning visible (REQ-4)
 * UX-T06 — cross-month warning does NOT disable submit (REQ-4)
 * UX-T07 — batch button fires 12 POST requests (REQ-3)
 * UX-T08 — batch tolerates 409 FISCAL_PERIOD_MONTH_EXISTS (REQ-3)
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Radix UI polyfills (required for Radix Select in jsdom) ───────────────────

beforeEach(() => {
  vi.clearAllMocks();
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = vi.fn(() => false);
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = vi.fn();
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = vi.fn();
  }
});

afterEach(() => cleanup());

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import PeriodCreateDialog from "../period-create-dialog";
import { toast } from "sonner";

const mockToastSuccess = vi.mocked(toast.success);

// ── Shared helpers ────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  open: true,
  onOpenChange: vi.fn(),
  orgSlug: "test-org",
  onCreated: vi.fn(),
};

/** Open the month Select and click an option by month name */
async function selectMonth(monthName: string) {
  const triggers = screen.getAllByRole("combobox");
  // The month select is the first combobox rendered
  const trigger = triggers[0];
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });
  fireEvent.click(trigger);
  const option = await screen.findByRole("option", { name: new RegExp(monthName) });
  fireEvent.click(option);
}

// ── UX-T02 — Month Select autocompletes startDate/endDate ────────────────────

describe("UX-T02 — Selección de mes autocompleta fechas (REQ-2)", () => {
  it("seleccionar Abril con year=2026 autocompleta startDate='2026-04-01' y endDate='2026-04-30'", async () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    // Set year to 2026 (it defaults to current year)
    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2026" } });

    await selectMonth("Abril");

    const startDateInput = screen.getByLabelText(/fecha de inicio/i);
    const endDateInput = screen.getByLabelText(/fecha de cierre/i);

    expect(startDateInput).toHaveValue("2026-04-01");
    expect(endDateInput).toHaveValue("2026-04-30");
  });

  it("seleccionar Febrero con year=2024 (bisiesto) autocompleta endDate='2024-02-29'", async () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2024" } });

    await selectMonth("Febrero");

    const endDateInput = screen.getByLabelText(/fecha de cierre/i);
    expect(endDateInput).toHaveValue("2024-02-29");
  });
});

// ── UX-T03 — Month Select autocompletes name ─────────────────────────────────

describe("UX-T03 — Selección de mes autocompleta nombre (REQ-2)", () => {
  it("seleccionar Abril con year=2026 autocompleta name='Abril 2026'", async () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2026" } });

    await selectMonth("Abril");

    const nameInput = screen.getByLabelText(/nombre/i);
    expect(nameInput).toHaveValue("Abril 2026");
  });

  it("seleccionar Enero con year=2025 autocompleta name='Enero 2025'", async () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2025" } });

    await selectMonth("Enero");

    const nameInput = screen.getByLabelText(/nombre/i);
    expect(nameInput).toHaveValue("Enero 2025");
  });
});

// ── UX-T01 — Placeholder + Microcopia ────────────────────────────────────────

describe("UX-T01 — Placeholder y microcopia presentes en el DOM (REQ-1)", () => {
  it("el input name tiene placeholder 'Ej: Abril 2026'", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);
    expect(
      screen.getByPlaceholderText("Ej: Abril 2026"),
    ).toBeInTheDocument();
  });

  it("el texto microcopia está presente en el DOM", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);
    expect(
      screen.getByText(
        "Un período fiscal representa un mes contable. Cerrás uno por mes.",
      ),
    ).toBeInTheDocument();
  });
});
