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
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorksheetFilters } from "../worksheet-filters";

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
