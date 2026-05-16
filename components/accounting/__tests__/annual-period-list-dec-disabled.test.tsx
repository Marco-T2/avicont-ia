/**
 * Phase 7.3 RED — December standalone monthly-close button disabled when
 * months 1-11 all CLOSED + FY OPEN (REQ-7.3).
 *
 * RED expected failure mode: Phase 7.1/7.2 GREEN sets `title` attribute on
 * the Dec disabled button to 'Diciembre se cierra junto con la gestion
 * anual' BUT lacks the explicit voseo accentuation 'gestión' (with é) and
 * does NOT verify the precise spec'd text. This test pins REQ-7.3 EXACT.
 *
 * Source of truth: spec REQ-7.3 (canonical tooltip) + REQ-7.4 voseo.
 *
 * Tests:
 *  (a) months 1-11 CLOSED + Dec OPEN + FY OPEN → Dec button disabled,
 *      tooltip 'Diciembre se cierra junto con la gestión anual'
 *  (b) month 6 OPEN (not all 1-11 closed) → Dec button enabled (link)
 *  (c) FY CLOSED → Dec row shows 'Cerrado' badge, no close button
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function buildGroup(
  year: number,
  monthStatuses: ("OPEN" | "CLOSED")[],
  fyStatus: "OPEN" | "CLOSED",
) {
  return {
    year,
    periods: monthStatuses.map((s, i) => period(year, i + 1, s)),
    fiscalYear: {
      id: `fy-${year}`,
      status: fyStatus,
      closedAt: null,
    },
    summary: null,
  };
}

function getDecemberCloseButton(): HTMLElement | null {
  // Dec row's Cerrar button — find disabled button inside the table row
  // whose first cell name contains 'Diciembre'. Walk the DOM.
  const decCell = Array.from(document.querySelectorAll("td")).find(
    (td) => td.textContent?.startsWith("Diciembre"),
  );
  const row = decCell?.closest("tr");
  if (!row) return null;
  return row.querySelector<HTMLElement>("button");
}

describe("AnnualPeriodList — REQ-7.3 December standalone close button", () => {
  it("(a) months 1-11 CLOSED + Dec OPEN + FY OPEN → Dec button disabled with EXACT voseo tooltip", () => {
    const statuses: ("OPEN" | "CLOSED")[] = [
      ...Array(11).fill("CLOSED") as ("OPEN" | "CLOSED")[],
      "OPEN" as const,
    ];
    const periodsByYear: PeriodsByYear = [buildGroup(2026, statuses, "OPEN")];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    const decBtn = getDecemberCloseButton();
    expect(decBtn).not.toBeNull();
    expect(decBtn).toBeDisabled();
    // REQ-7.3 exact text — voseo Rioplatense with accentuated 'gestión'.
    expect(decBtn?.getAttribute("title")).toBe(
      "Diciembre se cierra junto con la gestión anual",
    );
  });

  it("(b) month 6 OPEN (not all 1-11 closed) → Dec button is a navigation link, enabled", () => {
    const statuses: ("OPEN" | "CLOSED")[] = Array(12).fill("OPEN");
    statuses[0] = "CLOSED";
    statuses[1] = "CLOSED";
    // months 3..12 OPEN — gate NOT met
    const periodsByYear: PeriodsByYear = [buildGroup(2026, statuses, "OPEN")];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    // Dec row should still have its enabled link Cerrar button (asChild Link).
    const decCell = Array.from(document.querySelectorAll("td")).find((td) =>
      td.textContent?.startsWith("Diciembre"),
    );
    const decRow = decCell?.closest("tr");
    const decLink = decRow?.querySelector<HTMLAnchorElement>("a");
    expect(decLink).not.toBeNull();
    expect(decLink?.getAttribute("href")).toMatch(
      /\/accounting\/monthly-close\?periodId=p-2026-12/,
    );
  });

  it("(c) FY CLOSED → Dec row shows Cerrado badge, no close button rendered", () => {
    const statuses: ("OPEN" | "CLOSED")[] = Array(12).fill("CLOSED");
    const periodsByYear: PeriodsByYear = [buildGroup(2026, statuses, "CLOSED")];

    render(<AnnualPeriodList orgSlug={ORG_SLUG} periodsByYear={periodsByYear} />);

    const decCell = Array.from(document.querySelectorAll("td")).find((td) =>
      td.textContent?.startsWith("Diciembre"),
    );
    const decRow = decCell?.closest("tr");
    // No per-row Cerrar button when status=CLOSED.
    const decRowButtons = decRow?.querySelectorAll("button") ?? [];
    expect(decRowButtons.length).toBe(0);
    // 'Cerrado' badge present in Dec row.
    expect(decRow?.textContent).toMatch(/Cerrado/);
  });
});
