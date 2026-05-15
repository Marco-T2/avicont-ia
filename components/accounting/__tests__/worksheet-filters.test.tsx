/**
 * T27 — RED: WorksheetFilters component tests.
 *
 * Asserts:
 * (a) Date range inputs (dateFrom / dateTo) render.
 * (b) On submit, calls `onFilter` callback with correct WorksheetFilters shape.
 * (c) "Generar" (submit) button is present and clickable.
 *
 * Covers REQ-10 (UI surface).
 */

import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorksheetFilters, type FiscalPeriodOption } from "../worksheet-filters";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("WorksheetFilters (REQ-10)", () => {
  it("(a) renders dateFrom and dateTo inputs", () => {
    render(<WorksheetFilters onFilter={vi.fn()} loading={false} />);

    const dateFromInput = screen.getByLabelText(/fecha de inicio|dateFrom|desde/i);
    const dateToInput = screen.getByLabelText(/fecha de fin|dateTo|hasta/i);

    expect(dateFromInput).toBeInTheDocument();
    expect(dateToInput).toBeInTheDocument();
  });

  it("(b) calls onFilter with dateFrom/dateTo when form is submitted", () => {
    const onFilter = vi.fn();
    render(<WorksheetFilters onFilter={onFilter} loading={false} />);

    const dateFromInput = screen.getByLabelText(/fecha de inicio|dateFrom|desde/i);
    const dateToInput = screen.getByLabelText(/fecha de fin|dateTo|hasta/i);

    fireEvent.change(dateFromInput, { target: { value: "2025-01-01" } });
    fireEvent.change(dateToInput, { target: { value: "2025-12-31" } });

    const submitButton = screen.getByRole("button", { name: /generar|calcular|aplicar/i });
    fireEvent.click(submitButton);

    expect(onFilter).toHaveBeenCalledOnce();
    const callArg = onFilter.mock.calls[0][0] as { dateFrom: Date; dateTo: Date };
    expect(callArg).toHaveProperty("dateFrom");
    expect(callArg).toHaveProperty("dateTo");
    expect(callArg.dateFrom).toBeInstanceOf(Date);
    expect(callArg.dateTo).toBeInstanceOf(Date);
  });

  it("(c) submit button is present and enabled when dates are filled", () => {
    render(
      <WorksheetFilters
        onFilter={vi.fn()}
        loading={false}
        initialDateFrom="2025-01-01"
        initialDateTo="2025-12-31"
      />,
    );

    const submitButton = screen.getByRole("button", { name: /generar|calcular|aplicar/i });
    expect(submitButton).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
  });

  it("(d) submit button shows loading state when loading=true", () => {
    render(<WorksheetFilters onFilter={vi.fn()} loading={true} />);

    const submitButton = screen.getByRole("button", { name: /generar|calcular|aplicar|cargando/i });
    expect(submitButton).toBeDisabled();
  });
});

describe("WorksheetFilters — defaults + fiscal period selector", () => {
  // Fix "today" so defaults are deterministic.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("(e) default dateTo is today (YYYY-MM-DD)", () => {
    render(<WorksheetFilters onFilter={vi.fn()} loading={false} />);
    const dateToInput = screen.getByLabelText(/fecha de fin/i) as HTMLInputElement;
    expect(dateToInput.value).toBe("2026-05-15");
  });

  it("(f) default dateFrom is today minus one month (YYYY-MM-DD)", () => {
    render(<WorksheetFilters onFilter={vi.fn()} loading={false} />);
    const dateFromInput = screen.getByLabelText(/fecha de inicio/i) as HTMLInputElement;
    expect(dateFromInput.value).toBe("2026-04-15");
  });

  it("(g) initial props override defaults", () => {
    render(
      <WorksheetFilters
        onFilter={vi.fn()}
        loading={false}
        initialDateFrom="2026-01-01"
        initialDateTo="2026-01-31"
      />,
    );
    expect((screen.getByLabelText(/fecha de inicio/i) as HTMLInputElement).value).toBe("2026-01-01");
    expect((screen.getByLabelText(/fecha de fin/i) as HTMLInputElement).value).toBe("2026-01-31");
  });

  it("(h) renders fiscal period select when periods are provided", () => {
    const periods: FiscalPeriodOption[] = [
      { id: "p1", name: "Mayo 2026", startDate: "2026-05-01", endDate: "2026-05-31" },
      { id: "p2", name: "Abril 2026", startDate: "2026-04-01", endDate: "2026-04-30" },
    ];
    render(<WorksheetFilters onFilter={vi.fn()} loading={false} periods={periods} />);
    const select = screen.getByLabelText(/per[ií]odo fiscal/i) as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /mayo 2026/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /abril 2026/i })).toBeInTheDocument();
  });

  it("(i) selecting a period fills dateFrom/dateTo from its range", () => {
    const periods: FiscalPeriodOption[] = [
      { id: "p1", name: "Mayo 2026", startDate: "2026-05-01", endDate: "2026-05-31" },
    ];
    render(<WorksheetFilters onFilter={vi.fn()} loading={false} periods={periods} />);
    const select = screen.getByLabelText(/per[ií]odo fiscal/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "p1" } });
    expect((screen.getByLabelText(/fecha de inicio/i) as HTMLInputElement).value).toBe("2026-05-01");
    expect((screen.getByLabelText(/fecha de fin/i) as HTMLInputElement).value).toBe("2026-05-31");
  });

  it("(j) onFilter includes fiscalPeriodId when a period is selected", () => {
    const onFilter = vi.fn();
    const periods: FiscalPeriodOption[] = [
      { id: "p1", name: "Mayo 2026", startDate: "2026-05-01", endDate: "2026-05-31" },
    ];
    render(<WorksheetFilters onFilter={onFilter} loading={false} periods={periods} />);
    const select = screen.getByLabelText(/per[ií]odo fiscal/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: /generar/i }));
    expect(onFilter).toHaveBeenCalledOnce();
    expect(onFilter.mock.calls[0][0]).toMatchObject({ fiscalPeriodId: "p1" });
  });

  it("(k) onFilter omits fiscalPeriodId when no period is selected", () => {
    const onFilter = vi.fn();
    render(<WorksheetFilters onFilter={onFilter} loading={false} />);
    fireEvent.click(screen.getByRole("button", { name: /generar/i }));
    expect(onFilter).toHaveBeenCalledOnce();
    expect(onFilter.mock.calls[0][0].fiscalPeriodId).toBeUndefined();
  });
});
