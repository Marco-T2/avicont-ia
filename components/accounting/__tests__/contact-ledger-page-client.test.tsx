/**
 * RED — ContactLedgerPageClient contract (C5).
 *
 * Sister-clone of `ledger-page-client.test.tsx`. Covers the six contract
 * cases from spec REQ "Contact Ledger Detail" + "Status Column" + "Type
 * Column" + "API Contract — Contact Ledger" + "Cross-Cutting Constraints":
 *
 *   1. Tipo column — "Cobranza (efectivo)" para sourceType=receipt +
 *      paymentMethod=EFECTIVO; voucherTypeHuman ("Nota de Despacho") para
 *      sourceType=sale; "Ajuste" para sourceType=null + withoutAuxiliary=true.
 *   2. Estado column — "Parcial" (status=PARTIAL), "ATRASADO" runtime
 *      (status=PENDING + dueDate<hoy), "—" (status=null), "Sin auxiliar"
 *      (withoutAuxiliary=true) con icono warning.
 *   3. Opening balance row — primera fila bold "Saldo inicial acumulado"
 *      cuando openingBalance !== "0.00" (sister precedent in-table <tr>).
 *   4. Running balance — paridad sister: cada fila muestra el saldo
 *      acumulado calculado server-side (el cliente sólo lo renderiza).
 *   5. Export buttons disabled hasta consulta — sin filters.contactId /
 *      dateFrom / dateTo aplicados → ambos disabled. Con filters aplicados
 *      → enabled.
 *   6. Negativos es-BO — balance=-150.50 → cell muestra "(150,50)" con
 *      color destructive.
 *
 * Expected RED failure mode (per [[red_acceptance_failure_mode]]):
 *   The component file `../contact-ledger-page-client.tsx` does NOT exist
 *   yet. Vitest module resolution fails at import time → all tests error
 *   with `Cannot find module ../contact-ledger-page-client`. C5.2 GREEN
 *   creates the component and these assertions become real behavior gates.
 *
 * Per [[mock_hygiene_commit_scope]] + [[cross_module_boundary_mock_target_rewrite]]:
 *   ContactSelector mock target is the canonical client import path
 *   `@/components/contacts/contact-selector` (the same path the production
 *   component will use). Bundled in this RED commit so the GREEN component
 *   doesn't have to invent a different mock target.
 *
 * Lección C1 applied — RED targets the runtime surface (the rendered DOM
 * after mounting `ContactLedgerPageClient`), not a bare-object shape cast.
 */

import { render, screen, within, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

// ContactSelector swap (production component used by the page client). The
// stub renders a button that surfaces the typeFilter prop so we can verify
// the page wires CLIENTE vs PROVEEDOR through to the selector.
vi.mock("@/components/contacts/contact-selector", () => ({
  __esModule: true,
  default: ({
    typeFilter,
    value,
  }: {
    typeFilter?: string;
    value: string | null;
  }) => (
    <button
      type="button"
      data-testid="contact-selector-stub"
      data-type-filter={typeFilter ?? ""}
      data-value={value ?? ""}
    >
      ContactSelector stub
    </button>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ORG_SLUG = "test-org";

const CONTACT_ID = "contact-1";

function makeContacts() {
  return [
    {
      id: CONTACT_ID,
      type: "CLIENTE",
      name: "Cliente Demo",
      nit: "1234567",
      isActive: true,
    },
  ] as unknown as import("@/modules/contacts/presentation/index").Contact[];
}

type LedgerEntry = {
  entryId: string;
  date: string;
  entryNumber: number;
  voucherCode: string;
  displayNumber: string;
  description: string;
  debit: string;
  credit: string;
  balance: string;
  status: string | null;
  dueDate: string | null;
  voucherTypeHuman: string;
  sourceType: string | null;
  paymentMethod: string | null;
  bankAccountName: string | null;
  withoutAuxiliary: boolean;
};

function makeLedger(overrides: Partial<{
  page: number;
  openingBalance: string;
  items: LedgerEntry[];
  total: number;
}> = {}) {
  return {
    items: overrides.items ?? [],
    total: overrides.total ?? 0,
    page: overrides.page ?? 1,
    pageSize: 25,
    totalPages: 1,
    openingBalance: overrides.openingBalance ?? "0.00",
  };
}

function makeEntry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    entryId: overrides.entryId ?? "je-1",
    date: overrides.date ?? "2025-06-01T00:00:00.000Z",
    entryNumber: overrides.entryNumber ?? 1,
    voucherCode: overrides.voucherCode ?? "D",
    displayNumber: overrides.displayNumber ?? "D2506-000001",
    description: overrides.description ?? "Mov 1",
    debit: overrides.debit ?? "0.00",
    credit: overrides.credit ?? "0.00",
    balance: overrides.balance ?? "0.00",
    status: overrides.status ?? null,
    dueDate: overrides.dueDate ?? null,
    voucherTypeHuman: overrides.voucherTypeHuman ?? "Recibo",
    sourceType: overrides.sourceType ?? null,
    paymentMethod: overrides.paymentMethod ?? null,
    bankAccountName: overrides.bankAccountName ?? null,
    withoutAuxiliary: overrides.withoutAuxiliary ?? false,
  };
}

afterEach(() => cleanup());

// ── Import after mocks ────────────────────────────────────────────────────────

import ContactLedgerPageClient from "../contact-ledger-page-client";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ContactLedgerPageClient — Tipo column", () => {
  it("renders 'Cobranza (efectivo)' for receipt sourceType with EFECTIVO method", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-r",
              sourceType: "receipt",
              voucherTypeHuman: "Recibo",
              paymentMethod: "EFECTIVO",
              description: "Cobro factura A",
              debit: "0.00",
              credit: "100.00",
              balance: "-100.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Cobro factura A/i });
    expect(within(row).getByText(/Cobranza \(efectivo\)/i)).toBeInTheDocument();
  });

  it("renders voucherTypeHuman ('Nota de Despacho') for sale sourceType", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-s",
              sourceType: "sale",
              voucherTypeHuman: "Nota de Despacho",
              description: "Venta lote X",
              debit: "500.00",
              credit: "0.00",
              balance: "500.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Venta lote X/i });
    expect(within(row).getByText("Nota de Despacho")).toBeInTheDocument();
  });

  it("renders 'Ajuste' for null sourceType with withoutAuxiliary=true", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-m",
              sourceType: null,
              voucherTypeHuman: "Comprobante manual",
              description: "Ajuste contable",
              debit: "10.00",
              credit: "0.00",
              balance: "10.00",
              withoutAuxiliary: true,
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Ajuste contable/i });
    expect(within(row).getByText("Ajuste")).toBeInTheDocument();
  });
});

describe("ContactLedgerPageClient — Estado column", () => {
  it("renders 'Parcial' for status=PARTIAL", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-p",
              sourceType: "sale",
              voucherTypeHuman: "Factura",
              status: "PARTIAL",
              description: "Factura parcialmente cobrada",
              debit: "300.00",
              credit: "0.00",
              balance: "300.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Factura parcialmente cobrada/i });
    expect(within(row).getByText("Parcial")).toBeInTheDocument();
  });

  it("renders 'ATRASADO' runtime for status=PENDING with dueDate in the past", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-o",
              sourceType: "sale",
              voucherTypeHuman: "Factura",
              status: "PENDING",
              dueDate: "2020-01-01T00:00:00.000Z",
              description: "Factura vencida",
              debit: "1000.00",
              credit: "0.00",
              balance: "1000.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Factura vencida/i });
    expect(within(row).getByText("ATRASADO")).toBeInTheDocument();
  });

  it("renders '—' for null status", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-x",
              sourceType: "receipt",
              voucherTypeHuman: "Recibo",
              paymentMethod: "EFECTIVO",
              status: null,
              description: "Cobranza simple",
              debit: "0.00",
              credit: "50.00",
              balance: "-50.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Cobranza simple/i });
    // The Estado cell renders "—" (em-dash) for null status. Multiple "—"
    // exist in the row (decorative), so we query by cell role to scope.
    const cells = within(row).getAllByRole("cell");
    // Columns: Fecha | Tipo | Nº | Estado | Descripción | Debe | Haber | Saldo
    // Estado is index 3.
    expect(cells[3].textContent).toBe("—");
  });

  it("renders 'Sin auxiliar' with warning icon for withoutAuxiliary=true", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-w",
              sourceType: null,
              voucherTypeHuman: "Comprobante manual",
              description: "Asiento manual sin auxiliar",
              status: null,
              debit: "20.00",
              credit: "0.00",
              balance: "20.00",
              withoutAuxiliary: true,
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", {
      name: /Asiento manual sin auxiliar/i,
    });
    // Warning text + icon (aria-label "warning" or role=img). We assert the
    // semantic outcome — accessible warning marker visible to the user.
    expect(within(row).getByText(/Sin auxiliar/i)).toBeInTheDocument();
    expect(within(row).getByLabelText(/sin auxiliar/i)).toBeInTheDocument();
  });
});

describe("ContactLedgerPageClient — opening balance row", () => {
  it("renders 'Saldo inicial acumulado' <tr> when openingBalance !== '0.00'", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          openingBalance: "120.00",
          total: 1,
          items: [
            makeEntry({
              entryId: "je-1",
              sourceType: "sale",
              voucherTypeHuman: "Factura",
              description: "Movimiento intra rango",
              debit: "50.00",
              credit: "0.00",
              balance: "170.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const openingRow = screen.getByRole("row", {
      name: /Saldo inicial acumulado/i,
    });
    expect(openingRow).toBeInTheDocument();
    expect(openingRow.tagName).toBe("TR");
    expect(within(openingRow).getByText(/Bs\.\s*120[.,]00/)).toBeInTheDocument();
  });
});

describe("ContactLedgerPageClient — running balance", () => {
  it("renders the server-computed running balance in the Saldo cell per row", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 3,
          items: [
            makeEntry({
              entryId: "je-a",
              sourceType: "sale",
              voucherTypeHuman: "Factura",
              description: "Mov A",
              debit: "100.00",
              credit: "0.00",
              balance: "100.00",
            }),
            makeEntry({
              entryId: "je-b",
              sourceType: "sale",
              voucherTypeHuman: "Factura",
              description: "Mov B",
              debit: "50.00",
              credit: "0.00",
              balance: "150.00",
            }),
            makeEntry({
              entryId: "je-c",
              sourceType: "receipt",
              voucherTypeHuman: "Recibo",
              paymentMethod: "EFECTIVO",
              description: "Mov C",
              debit: "0.00",
              credit: "30.00",
              balance: "120.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    expect(
      within(screen.getByRole("row", { name: /Mov A/i })).getByText(
        /Bs\.\s*100[.,]00/,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Mov B/i })).getByText(
        /Bs\.\s*150[.,]00/,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("row", { name: /Mov C/i })).getByText(
        /Bs\.\s*120[.,]00/,
      ),
    ).toBeInTheDocument();
  });
});

describe("ContactLedgerPageClient — export buttons gating", () => {
  it("disables PDF and Excel buttons until contactId+dateFrom+dateTo are in URL filters", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={null}
        filters={{}}
        typeFilter="CLIENTE"
      />,
    );

    expect(screen.getByRole("button", { name: /PDF/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Excel/i })).toBeDisabled();
  });

  it("enables PDF and Excel buttons when filters carry contactId+dateFrom+dateTo", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({ total: 0, items: [] })}
        filters={{
          contactId: CONTACT_ID,
          dateFrom: "2025-06-01",
          dateTo: "2025-06-30",
        }}
        typeFilter="CLIENTE"
      />,
    );

    expect(screen.getByRole("button", { name: /PDF/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Excel/i })).not.toBeDisabled();
  });
});

describe("ContactLedgerPageClient — es-BO negative formatting", () => {
  it("renders negative balance as '(150,50)' with destructive color", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-neg",
              sourceType: "receipt",
              voucherTypeHuman: "Recibo",
              paymentMethod: "EFECTIVO",
              description: "Sobrepago contacto",
              debit: "0.00",
              credit: "150.50",
              balance: "-150.50",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Sobrepago contacto/i });
    const cells = within(row).getAllByRole("cell");
    // Saldo cell is the last data cell (column 7, 0-indexed). The 8-col
    // header is Fecha | Tipo | Nº | Estado | Descripción | Debe | Haber | Saldo.
    const saldoCell = cells[7];
    expect(saldoCell.textContent).toMatch(/\(150[.,]50\)/);
  });
});
