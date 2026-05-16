/**
 * Phase 7.1 RED — AnnualPeriodList accordion structure.
 *
 * Scope: REQ-7.1 (year accordion layout) + REQ-7.5 (mixed-status counts).
 *
 * RED expected failure mode: `components/accounting/annual-period-list.tsx`
 * does not exist yet → resolver throws ENOENT on import.
 *
 * Source of truth:
 *   - design rev 2 §8 (UI design — year accordion shape, server-side YearGroup)
 *   - spec REQ-7.1: accordion ordered newest first, current year expanded,
 *     header shows year + count "N/12 cerrados" + status badge "Abierta"/"Cerrada"
 *   - spec REQ-7.5: mixed-status year renders correct count "7/12 cerrados"
 *
 * Component contract (per design rev 2 §8 + orchestrator prompt):
 *   Props: { orgSlug, periodsByYear }
 *   `periodsByYear` shape (presentation DTO — server pre-narrows, R5 NO Prisma):
 *     Array<{
 *       year: number,
 *       periods: FiscalPeriodSnapshot[],           // 0..12 sorted by month asc
 *       fiscalYear: { id, status, closedAt, closingEntryId, openingEntryId } | null,
 *       summary: AnnualCloseSummary | null,
 *     }>
 *
 * Renders shadcn Accordion (type="multiple", defaultValue=[newestYear]).
 * Each year header: year number, status badge (Abierta/Cerrada), N/12 count.
 *
 * Voseo Rioplatense: badge "Abierta" / "Cerrada" (feminine — "la gestión"
 * is feminine in Rioplatense conta lexicon).
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

// next/navigation router stub — dialogs in nested children call useRouter.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// next/link → plain <a> for assert-friendly DOM.
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

// AnnualCloseDialog mocked to a stub — covered in Phase 7.4 RED.
vi.mock("../annual-close-dialog", () => ({
  default: vi.fn(() => null),
}));

import AnnualPeriodList, {
  type PeriodsByYear,
} from "../annual-period-list";

const ORG_SLUG = "acme";

/**
 * Helper: select only the accordion trigger buttons (year headers). The
 * accordion body contains many other buttons (per-period "Cerrar" actions)
 * that would otherwise match `getByRole('button', {name: /2026/})`.
 */
function getAccordionTriggers(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-slot="accordion-trigger"]',
    ),
  );
}

function findTriggerByYear(
  container: HTMLElement,
  year: number,
): HTMLElement | null {
  return (
    getAccordionTriggers(container).find((el) =>
      el.textContent?.includes(String(year)),
    ) ?? null
  );
}

function buildPeriod(year: number, month: number, status: "OPEN" | "CLOSED") {
  return {
    id: `p-${year}-${String(month).padStart(2, "0")}`,
    organizationId: "org-1",
    name: `${[
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
    ][month - 1]} ${year}`,
    year,
    month,
    startDate: new Date(`${year}-${String(month).padStart(2, "0")}-01`),
    endDate: new Date(`${year}-${String(month).padStart(2, "0")}-28`),
    status,
    closedAt: status === "CLOSED" ? new Date(`${year}-${String(month).padStart(2, "0")}-28`) : null,
    closedBy: status === "CLOSED" ? "user-1" : null,
    createdById: "user-1",
    createdAt: new Date(`${year}-01-01`),
    updatedAt: new Date(`${year}-01-01`),
  };
}

function mixedYear(year: number, closedCount: number): PeriodsByYear[number] {
  const periods = Array.from({ length: 12 }, (_, i) =>
    buildPeriod(year, i + 1, i < closedCount ? "CLOSED" : "OPEN"),
  );
  return {
    year,
    periods,
    fiscalYear: {
      id: `fy-${year}`,
      status: "OPEN",
      closedAt: null,
      closingEntryId: null,
      openingEntryId: null,
    },
    summary: null,
  };
}

describe("AnnualPeriodList — REQ-7.1 + REQ-7.5: accordion structure + counts", () => {
  it("renders one accordion header per year with year number, N/12 cerrados, status badge", () => {
    const periodsByYear: PeriodsByYear = [
      mixedYear(2026, 4),
      mixedYear(2025, 12),
    ];
    // year 2025 is closed
    periodsByYear[1].fiscalYear = {
      id: "fy-2025",
      status: "CLOSED",
      closedAt: new Date("2026-01-15"),
      closingEntryId: "je-cc-2025",
      openingEntryId: "je-ca-2026",
    };

    const { container } = render(
      <AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />,
    );

    // Year numbers visible — both rendered as accordion-trigger headers.
    expect(findTriggerByYear(container, 2026)).not.toBeNull();
    expect(findTriggerByYear(container, 2025)).not.toBeNull();

    // Count text per year — newest first 4/12, prior 12/12. Use getAllByText
    // because the year body also renders a duplicate count cell.
    expect(screen.getAllByText(/4\/12 cerrados/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/12\/12 cerrados/i).length).toBeGreaterThan(0);

    // Status badge — current year open ("Abierta"), prior closed ("Cerrada").
    expect(screen.getByText(/^Abierta$/)).toBeInTheDocument();
    expect(screen.getByText(/^Cerrada$/)).toBeInTheDocument();
  });

  it("orders years newest-first (2026 header appears before 2025 in DOM)", () => {
    const periodsByYear: PeriodsByYear = [mixedYear(2026, 4), mixedYear(2025, 12)];
    periodsByYear[1].fiscalYear = {
      id: "fy-2025",
      status: "CLOSED",
      closedAt: new Date("2026-01-15"),
      closingEntryId: "je-cc-2025",
      openingEntryId: "je-ca-2026",
    };

    const { container } = render(
      <AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />,
    );

    const headers = getAccordionTriggers(container);
    expect(headers).toHaveLength(2);
    expect(headers[0].textContent).toMatch(/2026/);
    expect(headers[1].textContent).toMatch(/2025/);
  });

  it("REQ-7.5 — mixed-status year shows '7/12 cerrados' for 7 closed + 5 open", () => {
    const periodsByYear: PeriodsByYear = [mixedYear(2026, 7)];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    expect(screen.getByText(/7\/12 cerrados/i)).toBeInTheDocument();
  });

  it("year with zero periods shows '0/12 cerrados'", () => {
    const periodsByYear: PeriodsByYear = [
      {
        year: 2022,
        periods: [],
        fiscalYear: {
          id: "fy-2022",
          status: "OPEN",
          closedAt: null,
          closingEntryId: null,
          openingEntryId: null,
        },
        summary: null,
      },
    ];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    expect(screen.getByText(/0\/12 cerrados/i)).toBeInTheDocument();
  });

  it("newest year is expanded by default (accordion item data-state=open)", () => {
    const periodsByYear: PeriodsByYear = [mixedYear(2026, 4), mixedYear(2025, 12)];
    periodsByYear[1].fiscalYear = {
      id: "fy-2025",
      status: "CLOSED",
      closedAt: new Date("2026-01-15"),
      closingEntryId: "je-cc-2025",
      openingEntryId: "je-ca-2026",
    };

    const { container } = render(
      <AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />,
    );

    // Newest year's header has aria-expanded="true"; prior has "false".
    const newest = findTriggerByYear(container, 2026);
    const prior = findTriggerByYear(container, 2025);
    expect(newest).not.toBeNull();
    expect(prior).not.toBeNull();
    expect(newest).toHaveAttribute("aria-expanded", "true");
    expect(prior).toHaveAttribute("aria-expanded", "false");
  });
});
