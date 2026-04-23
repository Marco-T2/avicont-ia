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

// ── UX-T04 — Manual edit wins over autocomplete ──────────────────────────────

describe("UX-T04 — Edición manual posterior no es sobreescrita (REQ-2)", () => {
  it("manual startDate edit after autocomplete retains manual value", async () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2026" } });

    // First: autocomplete via month select
    await selectMonth("Abril");

    const startDateInput = screen.getByLabelText(/fecha de inicio/i);

    // Confirm autocomplete applied
    expect(startDateInput).toHaveValue("2026-04-01");

    // Now manually edit startDate
    fireEvent.change(startDateInput, { target: { value: "2026-04-05" } });

    // Confirm manual value is retained
    expect(startDateInput).toHaveValue("2026-04-05");
  });

  it("selecting a new month after manual edit does NOT overwrite manual startDate", async () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2026" } });

    // Autocomplete Abril
    await selectMonth("Abril");

    const startDateInput = screen.getByLabelText(/fecha de inicio/i);

    // Manual edit
    fireEvent.change(startDateInput, { target: { value: "2026-04-05" } });

    // Select a different month (Mayo) — should NOT overwrite manual startDate
    await selectMonth("Mayo");

    // Manual value must be preserved
    expect(startDateInput).toHaveValue("2026-04-05");

    // endDate SHOULD be updated (not manually edited)
    const endDateInput = screen.getByLabelText(/fecha de cierre/i);
    expect(endDateInput).toHaveValue("2026-05-31");
  });
});

// ── UX-T05 + UX-T06 — Cross-month warning ────────────────────────────────────

describe("UX-T05 — Warning visible con rango cross-month (REQ-4)", () => {
  it("muestra el warning cuando startDate='2026-01-01' y endDate='2026-12-31'", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const startDateInput = screen.getByLabelText(/fecha de inicio/i);
    const endDateInput = screen.getByLabelText(/fecha de cierre/i);

    fireEvent.change(startDateInput, { target: { value: "2026-01-01" } });
    fireEvent.change(endDateInput, { target: { value: "2026-12-31" } });

    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent(
      /Este período abarca más de un mes/,
    );
  });

  it("NO muestra el warning cuando el rango es exactamente un mes (Abril 2026)", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const startDateInput = screen.getByLabelText(/fecha de inicio/i);
    const endDateInput = screen.getByLabelText(/fecha de cierre/i);

    fireEvent.change(startDateInput, { target: { value: "2026-04-01" } });
    fireEvent.change(endDateInput, { target: { value: "2026-04-30" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("UX-T06 — Warning no bloquea el submit (REQ-4)", () => {
  it("el botón 'Crear Período' está habilitado cuando el warning está visible y los campos requeridos completos", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    // Fill required fields with a cross-month range to trigger warning
    const nameInput = screen.getByLabelText(/nombre/i);
    const startDateInput = screen.getByLabelText(/fecha de inicio/i);
    const endDateInput = screen.getByLabelText(/fecha de cierre/i);

    fireEvent.change(nameInput, { target: { value: "Q1 2026" } });
    fireEvent.change(startDateInput, { target: { value: "2026-01-01" } });
    fireEvent.change(endDateInput, { target: { value: "2026-03-31" } });

    // Warning should be visible
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Submit button must NOT be disabled
    const submitBtn = screen.getByRole("button", { name: /crear período/i });
    expect(submitBtn).not.toBeDisabled();
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
