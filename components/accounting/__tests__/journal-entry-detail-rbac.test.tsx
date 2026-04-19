/**
 * T6.1 RED — accounting-rbac PR6
 *
 * REQ-ui-gating (resource=journal, action=write):
 * - matrix: journal write = [owner, admin, contador]
 * - cobrador/member → acciones OCULTAS (Editar, Contabilizar, Anular)
 * - contador/admin/owner → acciones VISIBLES
 */

import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import JournalEntryDetail from "../journal-entry-detail";
import { SystemRoleProvider } from "@/components/common/__tests__/_test-matrix-provider";

afterEach(() => cleanup());

// ── Mocks ──

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ orgSlug: "test-org" }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockRole = vi.hoisted(() => ({ current: "owner" as string | null }));

vi.mock("@/components/common/use-org-role", () => ({
  useOrgRole: () => ({ role: mockRole.current, isLoading: false, orgSlug: "test-org" }),
}));

function makeEntry(overrides: Record<string, unknown> = {}) {
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
      { id: "l1", debit: "500", credit: "0", description: null, account: { code: "1.1.1", name: "Caja" }, contact: null },
      { id: "l2", debit: "0", credit: "500", description: null, account: { code: "4.1.1", name: "Ventas" }, contact: null },
    ],
    sourceType: null,
    ...overrides,
  };
}

function renderDetail() {
  return render(
    <SystemRoleProvider role={mockRole.current}>
      <JournalEntryDetail
        orgSlug="test-org"
        entry={makeEntry({ status: "DRAFT", sourceType: null }) as any}
        periodName="Abril 2026"
        periodStatus="OPEN"
        voucherTypeName="Egreso"
      />
    </SystemRoleProvider>,
  );
}

describe("JournalEntryDetail — RBAC gating (journal/write)", () => {
  it("T6.1-je-1 — role=cobrador: Editar/Contabilizar OCULTOS", () => {
    mockRole.current = "cobrador";
    renderDetail();

    expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar/i })).not.toBeInTheDocument();
  });

  it("T6.1-je-2 — role=cobrador: acciones OCULTAS", () => {
    mockRole.current = "cobrador";
    renderDetail();

    expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar/i })).not.toBeInTheDocument();
  });

  it("T6.1-je-3 — role=member: acciones OCULTAS", () => {
    mockRole.current = "member";
    renderDetail();

    expect(screen.queryByRole("link", { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /contabilizar/i })).not.toBeInTheDocument();
  });

  it("T6.1-je-4 — role=contador: acciones VISIBLES (DRAFT → Editar + Contabilizar)", () => {
    mockRole.current = "contador";
    renderDetail();

    expect(screen.getByRole("link", { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /contabilizar/i })).toBeInTheDocument();
  });

  it("T6.1-je-5 — role=admin: acciones VISIBLES sobre POSTED (Anular)", () => {
    mockRole.current = "admin";
    render(
      <SystemRoleProvider role={mockRole.current}>
        <JournalEntryDetail
          orgSlug="test-org"
          entry={makeEntry({ status: "POSTED", sourceType: null }) as any}
          periodName="Abril 2026"
          periodStatus="OPEN"
          voucherTypeName="Egreso"
        />
      </SystemRoleProvider>,
    );

    expect(screen.getByRole("link", { name: /editar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /anular/i })).toBeInTheDocument();
  });
});
