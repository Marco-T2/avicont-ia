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

describe("UX-T05b — Warning ausente cuando los campos están vacíos (S-02)", () => {
  it("NO muestra el warning cuando startDate y endDate están vacíos (estado inicial)", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);
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

// ── UX-T07 — Batch button fires 12 POST requests ─────────────────────────────

describe("UX-T07 — Botón batch emite 12 requests (REQ-3)", () => {
  it("'Crear los 12 meses de {year}' renderiza y al hacer click emite exactamente 12 fetch calls", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    // Set year
    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2026" } });

    // The batch button should be present
    const batchBtn = screen.getByRole("button", { name: /crear los 12 meses de 2026/i });
    expect(batchBtn).toBeInTheDocument();

    // Click batch button
    fireEvent.click(batchBtn);

    // Wait for all 12 calls to complete
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });

    // Verify each call has the correct method and URL pattern
    const calls = fetchMock.mock.calls as [string, RequestInit][];
    calls.forEach(([url, opts]) => {
      expect(url).toMatch(/\/api\/organizations\/test-org\/periods/);
      expect(opts.method).toBe("POST");
    });

    // Verify month 4 (Abril) has correct dates
    const abrilBody = JSON.parse(calls[3][1].body as string) as {
      name: string;
      startDate: string;
      endDate: string;
      year: number;
    };
    expect(abrilBody.name).toBe("Abril 2026");
    expect(abrilBody.startDate).toBe("2026-04-01");
    expect(abrilBody.endDate).toBe("2026-04-30");

    // Verify Febrero has correct last day
    const febreroBody = JSON.parse(calls[1][1].body as string) as {
      endDate: string;
    };
    expect(febreroBody.endDate).toBe("2026-02-28");
  });
});

// ── UX-T08 — Batch tolerates 409 duplicates ──────────────────────────────────

describe("UX-T08 — Batch tolera 409 FISCAL_PERIOD_MONTH_EXISTS (REQ-3)", () => {
  it("3 respuestas 409 → toast muestra '9 períodos creados, 3 ya existían' y dialog cierra", async () => {
    const onOpenChange = vi.fn();

    // months 1, 3, 5 return 409; rest return 201
    const fetchMock = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      const body = JSON.parse((opts?.body as string) ?? "{}") as { startDate?: string };
      const month = body.startDate ? parseInt(body.startDate.split("-")[1], 10) : 0;
      if (month === 1 || month === 3 || month === 5) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ code: "FISCAL_PERIOD_MONTH_EXISTS" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({}),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PeriodCreateDialog
        open={true}
        onOpenChange={onOpenChange}
        orgSlug="test-org"
        onCreated={vi.fn()}
      />,
    );

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2026" } });

    const batchBtn = screen.getByRole("button", { name: /crear los 12 meses de 2026/i });
    fireEvent.click(batchBtn);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    const toastArg = mockToastSuccess.mock.calls[0][0] as string;
    expect(toastArg).toMatch(/9 períodos creados/);
    expect(toastArg).toMatch(/3 ya existían/);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ── UX-T08b — Batch counts non-FISCAL_PERIOD_MONTH_EXISTS 409 as FAILED ──────

describe("UX-T08b — 409 con código distinto a FISCAL_PERIOD_MONTH_EXISTS cuenta como fallido (S-01)", () => {
  it("409 con body { error: '...', code: 'SOME_OTHER_ERROR' } cuenta como fallido, no como ya existía", async () => {
    const onOpenChange = vi.fn();

    // month 1 returns 409 with a different error code; rest return 201
    const fetchMock = vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
      const body = JSON.parse((opts?.body as string) ?? "{}") as { startDate?: string };
      const month = body.startDate ? parseInt(body.startDate.split("-")[1], 10) : 0;
      if (month === 1) {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ error: "Conflict", code: "SOME_OTHER_ERROR" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({}),
      });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      <PeriodCreateDialog
        open={true}
        onOpenChange={onOpenChange}
        orgSlug="test-org"
        onCreated={vi.fn()}
      />,
    );

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2026" } });

    const batchBtn = screen.getByRole("button", { name: /crear los 12 meses de 2026/i });
    fireEvent.click(batchBtn);

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    const toastArg = mockToastSuccess.mock.calls[0][0] as string;
    // month 1 must be FAILED (not skipped)
    expect(toastArg).toMatch(/11 períodos creados/);
    expect(toastArg).toMatch(/1 fallidos/);
    expect(toastArg).not.toMatch(/ya existían/);
  });
});

// ── Year validation ───────────────────────────────────────────────────────────

describe("Year validation — batch button disabled when year is out of range", () => {
  it("batch button is enabled when year=2026 (valid)", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2026" } });

    const batchBtn = screen.getByRole("button", { name: /crear los 12 meses/i });
    expect(batchBtn).not.toBeDisabled();
  });

  it("batch button is disabled when year=1999 (below 2000)", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "1999" } });

    const batchBtn = screen.getByRole("button", { name: /crear los 12 meses/i });
    expect(batchBtn).toBeDisabled();
  });

  it("batch button is disabled when year=2101 (above 2100)", () => {
    render(<PeriodCreateDialog {...DEFAULT_PROPS} />);

    const yearInput = screen.getByLabelText(/año/i);
    fireEvent.change(yearInput, { target: { value: "2101" } });

    const batchBtn = screen.getByRole("button", { name: /crear los 12 meses/i });
    expect(batchBtn).toBeDisabled();
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
