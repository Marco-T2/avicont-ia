/**
 * Phase 7.2 RED — year-close button gate (REQ-7.2 + REQ-7.4 voseo).
 *
 * RED expected failure mode: tests assert specific button-text + disabled
 * state per gate (CLOSED FY / missing-months / gate-allowed / no summary
 * / unbalanced via summary.gateReason). The Phase 7.1 GREEN impl handles
 * the basic CLOSED/missing/allowed dispatch BUT the button labels and
 * tooltip wording may differ from the spec — these tests pin REQ-7.2 +
 * voseo Rioplatense EXACT and will flag any divergence.
 *
 * Specifically asserts:
 *   - CLOSED FY → 'Año cerrado el {date}' (voseo formatDateBO)
 *   - missing months → 'Falta cerrar meses' (voseo Rioplatense)
 *   - gate allowed → 'Cerrar la gestion {year}' enabled, primary variant
 *   - balance unbalanced via summary → 'no cuadran' tooltip
 *   - drafts in Dec via summary → 'borradores' tooltip
 *
 * Source of truth: spec REQ-7.2 + orchestrator prompt button-state matrix.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AnnualCloseSummary } from "@/modules/annual-close/presentation/index";

afterEach(() => cleanup());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("../annual-close-dialog", () => ({
  default: vi.fn(() => null),
}));

import AnnualPeriodList, {
  type PeriodsByYear,
} from "../annual-period-list";

const ORG_SLUG = "acme";

const monthsEs = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function period(year: number, month: number, status: "OPEN" | "CLOSED") {
  return {
    id: `p-${year}-${String(month).padStart(2, "0")}`,
    organizationId: "org-1",
    name: `${monthsEs[month - 1]} ${year}`,
    year,
    month,
    startDate: new Date(`${year}-${String(month).padStart(2, "0")}-01`),
    endDate: new Date(`${year}-${String(month).padStart(2, "0")}-28`),
    status,
    closedAt: status === "CLOSED"
      ? new Date(`${year}-${String(month).padStart(2, "0")}-28`)
      : null,
    closedBy: status === "CLOSED" ? "user-1" : null,
    createdById: "user-1",
    createdAt: new Date(`${year}-01-01`),
    updatedAt: new Date(`${year}-01-01`),
  };
}

function gateAllowedSummary(year: number): AnnualCloseSummary {
  return {
    year,
    fiscalYearStatus: "OPEN",
    periods: { closed: 11, open: 1, total: 12 },
    decemberStatus: "OPEN",
    ccExists: false,
    gateAllowed: true,
    balance: { debit: "100000.00", credit: "100000.00", balanced: true },
  };
}

function gateDeniedSummary(
  year: number,
  reason: string,
  overrides: Partial<AnnualCloseSummary> = {},
): AnnualCloseSummary {
  return {
    year,
    fiscalYearStatus: "OPEN",
    periods: { closed: 7, open: 5, total: 12 },
    decemberStatus: "OPEN",
    ccExists: false,
    gateAllowed: false,
    gateReason: reason,
    balance: { debit: "100000.00", credit: "100000.00", balanced: true },
    ...overrides,
  };
}

function buildGroup(
  year: number,
  closedCount: number,
  fyStatus: "OPEN" | "CLOSED",
  summary: AnnualCloseSummary | null,
  closedAt: Date | null = null,
) {
  return {
    year,
    periods: Array.from({ length: 12 }, (_, i) =>
      period(year, i + 1, i < closedCount ? "CLOSED" : "OPEN"),
    ),
    fiscalYear: {
      id: `fy-${year}`,
      status: fyStatus,
      closedAt,
      closingEntryId: fyStatus === "CLOSED" ? "je-cc" : null,
      openingEntryId: fyStatus === "CLOSED" ? "je-ca" : null,
    },
    summary,
  };
}

function getYearCloseButton(headerRowYear: number): HTMLElement | null {
  // The year-close button is rendered in the year body header row
  // (NOT the accordion trigger). Exclude accordion triggers + Cerrar
  // per-period buttons; match year-close button by its known label prefixes.
  const buttons = screen.queryAllByRole("button");
  return (
    buttons.find((b) => {
      if (b.getAttribute("data-slot") === "accordion-trigger") return false;
      const txt = b.textContent ?? "";
      return (
        txt.includes(`Cerrar la gestión ${headerRowYear}`) ||
        txt.includes("Año cerrado") ||
        txt.includes("Falta cerrar meses") ||
        txt.includes("Resolve los pendientes") ||
        txt.includes("Asientos no cuadran") ||
        txt.includes("Resolve borradores")
      );
    }) ?? null
  );
}

describe("AnnualPeriodList — REQ-7.2 year-close button gate", () => {
  it("CLOSED FY → button shows 'Año cerrado el {date}' and is disabled", () => {
    const periodsByYear: PeriodsByYear = [
      buildGroup(2025, 12, "CLOSED", null, new Date("2026-01-15")),
    ];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    const btn = screen.getByRole("button", { name: /Año cerrado el/i });
    expect(btn).toBeDisabled();
    // formatDateBO is dd/mm/yyyy in Bolivia locale — assert date pattern present
    expect(btn.textContent).toMatch(/Año cerrado el\s+\d{2}\/\d{2}\/\d{4}/);
  });

  it("gate allowed via summary → button 'Cerrar la gestion {year}' is enabled and primary", () => {
    const periodsByYear: PeriodsByYear = [
      buildGroup(2026, 11, "OPEN", gateAllowedSummary(2026)),
    ];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    const btn = screen.getByRole("button", { name: /Cerrar la gestión 2026/i });
    expect(btn).not.toBeDisabled();
    // primary variant — data-variant="default"
    expect(btn).toHaveAttribute("data-variant", "default");
  });

  it("missing months (no summary) → button disabled with 'Falta cerrar' text", () => {
    const periodsByYear: PeriodsByYear = [
      buildGroup(2026, 7, "OPEN", null),
    ];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    const btn = screen.getByRole("button", { name: /Falta cerrar/i });
    expect(btn).toBeDisabled();
  });

  it("gate denied via summary with unbalanced balance → button text 'Asientos no cuadran' + voseo tooltip", () => {
    const periodsByYear: PeriodsByYear = [
      buildGroup(
        2026,
        11,
        "OPEN",
        gateDeniedSummary(
          2026,
          "Los asientos del año no cuadran (DEBE ≠ HABER).",
          { balance: { debit: "100.00", credit: "90.00", balanced: false } },
        ),
      ),
    ];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    const btn = screen.getByRole("button", { name: /Asientos no cuadran/i });
    expect(btn).toBeDisabled();
    const reasonText =
      btn.getAttribute("title") ?? btn.getAttribute("aria-label") ?? "";
    expect(reasonText).toMatch(/no cuadran/i);
  });

  it("gate denied via summary with December drafts → button text 'Resolve borradores de diciembre' + voseo tooltip", () => {
    const periodsByYear: PeriodsByYear = [
      buildGroup(
        2026,
        11,
        "OPEN",
        gateDeniedSummary(
          2026,
          "Hay borradores en diciembre — resolvelos antes de cerrar la gestion.",
        ),
      ),
    ];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    const btn = screen.getByRole("button", {
      name: /Resolve borradores de diciembre/i,
    });
    expect(btn).toBeDisabled();
    const reasonText =
      btn.getAttribute("title") ?? btn.getAttribute("aria-label") ?? "";
    expect(reasonText).toMatch(/borradores/i);
  });
});
