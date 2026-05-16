/**
 * Component tests for journal-entry-form date-driven period derivation.
 *
 * Tras quitar el `<Select>` de Período (Marco UX, 2026-05-16), el período es
 * un derivado puro de la fecha — no hay input editable. El form muestra un
 * hint inline (data-testid="period-hint") con el formato:
 *   "✓ Período: Abril 2026"        (status OPEN)
 *   "✗ Período: Abril 2026 — CERRADO" (status CLOSED, bloquea submit)
 *
 * JF-T01 — Auto-derive on mount, new entry (REQ-1)
 * JF-T02 — Date change re-derives period (REQ-1)
 * JF-T04 — No match → warning visible and submit disabled (REQ-2 + REQ-3)
 * JF-T05 — Match restored → warning hidden and hint re-derived (REQ-2)
 * JF-T06 — Edit mode mount: hint matches the entry's period (REQ-1)
 * JF-T07 — Edit mode date change re-derives (REQ-1)
 * JF-T08 — Inclusive startDate boundary (REQ-4)
 * JF-T09 — Inclusive endDate boundary (REQ-4)
 * JF-T10 — CLOSED period that covers the date renders red hint (Marco UX, 2026-05-16)
 *
 * JF-T03 (Manual override wins on date change) — REMOVED. El comportamiento de
 * override manual desapareció con el rediseño: el período ya no es seleccionable.
 *
 * TZ NOTE: Bolivia is UTC-4. All period dates use explicit UTC midnight (T00:00:00.000Z)
 * so that .toISOString().slice(0,10) returns the correct calendar date.
 * Date inputs are strings "YYYY-MM-DD" — never construct Date from them for comparison.
 */

import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  // Pin system clock to an April date so todayLocal() returns "2026-04-15",
  // which falls inside APRIL_PERIOD. Sin esto el lazy init en May+ runs
  // resuelve a periodId="" y dispara el banner "no open period".
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-04-15T12:00:00.000Z"));

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

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/accounting/journal-line-row", () => ({
  default: () => null,
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import JournalEntryForm from "../journal-entry-form";

// ── Shared fixtures ───────────────────────────────────────────────────────────


function makePeriod(overrides: Record<string, unknown> = {}): any {
  return {
    id: "period-april",
    name: "Abril 2026",
    startDate: new Date("2026-04-01T00:00:00.000Z"),
    endDate: new Date("2026-04-30T00:00:00.000Z"),
    status: "OPEN",
    organizationId: "org-1",
    year: 2026,
    createdById: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}


const BASE_VOUCHER_TYPE: any = {
  id: "vt-1",
  code: "CE",
  name: "Egreso",
  description: null,
  isActive: true,
  organizationId: "org-1",
};


const BASE_ACCOUNT: any = {
  id: "acc-1",
  code: "1.1.1",
  name: "Caja",
  type: "ACTIVO",
  nature: "DEUDORA",
  subtype: null,
  isDetail: true,
  requiresContact: false,
  isActive: true,
  organizationId: "org-1",
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  description: null,
};

const APRIL_PERIOD = makePeriod();

const MAY_PERIOD = makePeriod({
  id: "period-may",
  name: "Mayo 2026",
  startDate: new Date("2026-05-01T00:00:00.000Z"),
  endDate: new Date("2026-05-31T00:00:00.000Z"),
  status: "OPEN",
});

// ── JF-T01 — Auto-derive on mount, new entry ─────────────────────────────────

describe("JF-T01 — Auto-derive on mount: new entry with date inside OPEN period", () => {
  it("period hint shows the matching OPEN period name on mount", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const hint = screen.getByTestId("period-hint");
    expect(hint).toHaveTextContent("Período: Abril 2026");
    expect(hint.textContent).toMatch(/^✓/);
  });
});

// ── JF-T02 — Date change re-derives period ────────────────────────────────────

describe("JF-T02 — Date change re-derives period", () => {
  it("changing date to May updates the hint to the May period", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD, MAY_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-05-15" } });

    expect(screen.getByTestId("period-hint")).toHaveTextContent(
      "Período: Mayo 2026",
    );
  });
});

// ── JF-T04 — No match → warning visible and submit disabled ──────────────────

describe("JF-T04 — Uncovered date shows warning banner and disables submit", () => {
  it("warning banner with role=alert is visible when date is not covered by any OPEN period", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-06-15" } });

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(
      "No hay un período fiscal para esta fecha",
    );
  });

  it("submit button is disabled when date is not covered by any OPEN period", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-06-15" } });

    const submitButtons = screen
      .getAllByRole("button")
      .filter(
        (btn) =>
          btn.getAttribute("type") === "submit" ||
          btn.textContent?.includes("Guardar Borrador") ||
          btn.textContent?.includes("Contabilizar"),
      );
    expect(submitButtons.some((btn) => btn.hasAttribute("disabled"))).toBe(true);
  });
});

// ── JF-T05 — Match restored → warning hidden and periodId derived ────────────

describe("JF-T05 — Covered date after uncovered: warning hidden, hint re-derived", () => {
  it("warning banner disappears and hint shows period name when date returns to a covered value", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);

    fireEvent.change(dateInput, { target: { value: "2026-06-15" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.change(dateInput, { target: { value: "2026-04-20" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("period-hint")).toHaveTextContent(
      "Período: Abril 2026",
    );
  });
});

// ── JF-T06 — Edit mode: hint reflects entry's period ─────────────────────────

describe("JF-T06 — Edit mode: hint reflects the entry's period on mount", () => {
  it("hint matches the period covering editEntry.date on mount", () => {
    const editEntry = {
      id: "entry-1",
      number: 42,
      date: "2026-04-15",
      description: "Test entry",
      periodId: "period-april",
      voucherTypeId: "vt-1",
      referenceNumber: null,
      lines: [
        { accountId: "acc-1", debit: 100, credit: 0, description: null, contactId: null },
        { accountId: "acc-1", debit: 0, credit: 100, description: null, contactId: null },
      ],
    };

    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={editEntry}
      />,
    );

    expect(screen.getByTestId("period-hint")).toHaveTextContent(
      "Período: Abril 2026",
    );
  });
});

// ── JF-T07 — Edit mode: date change re-derives period ────────────────────────

describe("JF-T07 — Edit mode: date change re-derives period", () => {
  it("changing date in edit mode updates the hint to the new period", () => {
    const editEntry = {
      id: "entry-1",
      number: 42,
      date: "2026-04-15",
      description: "Test entry",
      periodId: "period-april",
      voucherTypeId: "vt-1",
      referenceNumber: null,
      lines: [
        { accountId: "acc-1", debit: 100, credit: 0, description: null, contactId: null },
        { accountId: "acc-1", debit: 0, credit: 100, description: null, contactId: null },
      ],
    };

    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD, MAY_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={editEntry}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-05-10" } });

    expect(screen.getByTestId("period-hint")).toHaveTextContent(
      "Período: Mayo 2026",
    );
  });
});

// ── JF-T08 — Inclusive startDate boundary ────────────────────────────────────

describe("JF-T08 — Inclusive startDate boundary (REQ-4)", () => {
  it("date equal to period.startDate matches and hint shows the period", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-04-01" } });

    expect(screen.getByTestId("period-hint")).toHaveTextContent(
      "Período: Abril 2026",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ── JF-T09 — Inclusive endDate boundary ──────────────────────────────────────

describe("JF-T09 — Inclusive endDate boundary (REQ-4)", () => {
  it("date equal to period.endDate matches and hint shows the period", () => {
    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_PERIOD]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const dateInput = screen.getByLabelText(/fecha/i);
    fireEvent.change(dateInput, { target: { value: "2026-04-30" } });

    expect(screen.getByTestId("period-hint")).toHaveTextContent(
      "Período: Abril 2026",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ── JF-T10 — CLOSED period that covers the date renders red hint ─────────────

describe("JF-T10 — CLOSED period covering the date: red hint + submit disabled", () => {
  it("renders red hint and the warning banner when the only covering period is CLOSED", () => {
    const APRIL_CLOSED = makePeriod({ status: "CLOSED" });

    render(
      <JournalEntryForm
        orgSlug="test-org"
        accounts={[BASE_ACCOUNT]}
        periods={[APRIL_CLOSED]}
        voucherTypes={[BASE_VOUCHER_TYPE]}
        editEntry={undefined}
      />,
    );

    const hint = screen.getByTestId("period-hint");
    expect(hint).toHaveTextContent("Período: Abril 2026");
    expect(hint).toHaveTextContent("CERRADO");
    expect(hint.textContent).toMatch(/^✗/);

    // Banner rojo "El período X está cerrado..." (no el amarillo). El amarillo
    // es para "no existe período"; el rojo es para "existe pero CLOSED".
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Abril 2026");
    expect(alert).toHaveTextContent(/está cerrado/i);
  });
});
