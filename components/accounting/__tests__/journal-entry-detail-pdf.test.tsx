/**
 * T8 — Botón "Descargar PDF" en el detalle del asiento.
 *
 * RED: el botón no existe todavía.
 */
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import JournalEntryDetail from "../journal-entry-detail";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => {
  cleanup();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: "owner", isLoading: false, orgSlug: "test-org" }),
}));

function renderOwner(node: React.ReactNode) {
  return render(<SystemRoleProvider role="owner">{node}</SystemRoleProvider>);
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "je-pdf-1",
    number: 145,
    date: "2025-08-19",
    description: "A rendir ECR",
    status: "POSTED",
    periodId: "p-1",
    voucherTypeId: "vt-CE",
    sourceType: null,
    contact: null,
    lines: [
      { id: "l1", debit: "3760", credit: "0", account: { code: "1.1.1", name: "Caja" }, contact: null },
      { id: "l2", debit: "0", credit: "3760", account: { code: "4.1.1", name: "Banco" }, contact: null },
    ],
    ...overrides,
  };
}

describe("JournalEntryDetail — PDF download button", () => {
  it("renderiza un link 'Descargar PDF' apuntando al endpoint con ?format=pdf", () => {
    renderOwner(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeEntry()}
        periodName="2025-08"
        periodStatus="OPEN"
        voucherTypeName="EGRESO"
      />,
    );

    const link = screen.getByRole("link", { name: /descargar pdf/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "/api/organizations/test-org/journal/je-pdf-1?format=pdf",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("el link sigue visible en estado VOIDED (un anulado también se debe poder imprimir)", () => {
    renderOwner(
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeEntry({ status: "VOIDED" })}
        periodName="2025-08"
        periodStatus="OPEN"
        voucherTypeName="EGRESO"
      />,
    );

    expect(screen.getByRole("link", { name: /descargar pdf/i })).toBeInTheDocument();
  });
});
