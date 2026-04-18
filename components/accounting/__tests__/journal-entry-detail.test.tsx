/**
 * T4.2 RED (REQ-B.2, S-B2.1 + S-B2.2)
 * T6.4 RED (REQ-D.2) — detail renders date via formatDateBO (TZ-safe DD/MM/YYYY)
 *
 * T4.2 fails until sourceType field and badge are added in T4.4 GREEN.
 * T6.4 fails until local formatDate is replaced with formatDateBO (T6.5).
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import JournalEntryDetail from "../journal-entry-detail";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// accounting-rbac PR6: default owner so <Gated> renders children
vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "owner", isLoading: false, orgSlug: "test-org" }),
}));

// ── Fixtures ──

function makeDetailEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "je-1",
    number: 42,
    date: "2026-04-17",
    description: "Asiento de prueba",
    status: "DRAFT",
    periodId: "period-1",
    voucherTypeId: "vt-1",
    createdAt: "2026-04-17T10:00:00.000Z",
    contact: null,
    lines: [
      {
        id: "line-1",
        debit: "500",
        credit: "0",
        description: null,
        account: { code: "1.1.1", name: "Caja" },
        contact: null,
      },
      {
        id: "line-2",
        debit: "0",
        credit: "500",
        description: null,
        account: { code: "4.1.1", name: "Ventas" },
        contact: null,
      },
    ],
    sourceType: null,
    ...overrides,
  };
}

// ── T7.1–T7.6 RED: "Editar" button visibility follows period-gate + origin rule (REQ-A.2) ──

describe("JournalEntryDetail — Editar button visibility (REQ-A.2)", () => {
  it("T7.1 — DRAFT manual + periodStatus=OPEN → Editar button renders with /edit link", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ status: "DRAFT", sourceType: null }) as any}
        periodName="Abril 2026"
        periodStatus="OPEN"
        voucherTypeName="Egreso"
      />,
    );
    const editButton = screen.getByRole("link", { name: /editar/i });
    expect(editButton).toBeInTheDocument();
    expect(editButton).toHaveAttribute("href", "/test-org/accounting/journal/je-1/edit");
  });

  it("T7.2 — POSTED manual (sourceType=null) + periodStatus=OPEN → Editar button renders", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ status: "POSTED", sourceType: null }) as any}
        periodName="Abril 2026"
        periodStatus="OPEN"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.getByRole("link", { name: /editar/i })).toBeInTheDocument();
  });

  it("T7.3 — POSTED auto (sourceType=sale) + periodStatus=OPEN → Editar button hidden", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ status: "POSTED", sourceType: "sale" }) as any}
        periodName="Abril 2026"
        periodStatus="OPEN"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
  });

  it("T7.4 — DRAFT manual + periodStatus=CLOSED → Editar button hidden", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ status: "DRAFT", sourceType: null }) as any}
        periodName="Abril 2026"
        periodStatus="CLOSED"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
  });

  it("T7.5 — POSTED manual + periodStatus=CLOSED → Editar button hidden", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ status: "POSTED", sourceType: null }) as any}
        periodName="Abril 2026"
        periodStatus="CLOSED"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
  });

  it("T7.6 — VOIDED + periodStatus=OPEN → Editar button hidden", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ status: "VOIDED", sourceType: null }) as any}
        periodName="Abril 2026"
        periodStatus="OPEN"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
  });
});

// ── T4.2: detail renders origin badge in metadata section ──

describe("JournalEntryDetail — origin badge (REQ-B.2)", () => {
  it("S-B2.1 — sourceType=null renders badge 'Manual' in metadata", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ sourceType: null }) as any}
        periodName="Abril 2026"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.getByText("Manual")).toBeInTheDocument();
  });

  it("S-B2.2 — sourceType='sale' renders badge 'Generado por Venta' in metadata", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry({ sourceType: "sale" }) as any}
        periodName="Abril 2026"
        voucherTypeName="Egreso"
      />,
    );
    expect(screen.getByText("Generado por Venta")).toBeInTheDocument();
  });
});

// ── T5.5 (voucher-types REQ-A.4-S3): inactive voucher type badge in detail ──

describe("JournalEntryDetail — inactive voucher type badge (REQ-A.4-S3)", () => {
  it("A.4-S3 — voucherTypeActive=false renders 'Inactivo' badge next to name", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry() as any}
        periodName="Abril 2026"
        periodStatus="OPEN"
        voucherTypeName="Legacy"
        voucherTypeActive={false}
      />,
    );
    expect(screen.getByText("Legacy")).toBeInTheDocument();
    expect(screen.getByText("Inactivo")).toBeInTheDocument();
  });

  it("A.4-S3 — voucherTypeActive=true does NOT render 'Inactivo' badge", () => {
    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeDetailEntry() as any}
        periodName="Abril 2026"
        periodStatus="OPEN"
        voucherTypeName="Egreso"
        voucherTypeActive={true}
      />,
    );
    expect(screen.queryByText("Inactivo")).not.toBeInTheDocument();
  });
});

// ── T6.4 RED: detail renders date via formatDateBO (TZ-safe) ──

describe("JournalEntryDetail — display-date TZ-safe (REQ-D.2)", () => {
  it("T6.4 — renders entry date as DD/MM/YYYY, not shifted under UTC-4", () => {
    // Simulate Bolivia at 21:00 local = 01:00 UTC next day
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T01:00:00.000Z"));

    // Entry date stored at UTC-noon (TZ-safe convention)
    const entry = makeDetailEntry({
      date: "2026-04-17T12:00:00.000Z",
      createdAt: "2026-04-17T12:00:00.000Z",
    });

    render(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={entry as any}
        periodName="Abril 2026"
        voucherTypeName="Egreso"
      />,
    );

    // Must show 17/04/2026, not the locale long format ("17 de abril de 2026")
    // getAllByText because date and createdAt both render the same value
    const dateEls = screen.getAllByText("17/04/2026");
    expect(dateEls.length).toBeGreaterThanOrEqual(1);
  });
});
