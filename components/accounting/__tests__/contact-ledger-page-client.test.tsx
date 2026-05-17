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
  paymentDirection: string | null;
  documentTypeCode: string | null;
  documentReferenceNumber: string | null;
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
    paymentDirection: overrides.paymentDirection ?? null,
    documentTypeCode: overrides.documentTypeCode ?? null,
    documentReferenceNumber: overrides.documentReferenceNumber ?? null,
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

  it("BF3 — renders 'Cobranza (efectivo)' for sourceType=payment + paymentDirection=COBRO (bug #1 root)", () => {
    // BUG #1: producción crea TODOS los payments con sourceType="payment"
    // (el valor "receipt" no se usa runtime). Antes de BF3 una cobranza en
    // efectivo salía como "Pago (efectivo)" porque renderTipo sólo miraba
    // sourceType. El fix usa paymentDirection como discriminador.
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-cob",
              sourceType: "payment",
              paymentDirection: "COBRO",
              voucherTypeHuman: "Comprobante de Ingreso",
              paymentMethod: "EFECTIVO",
              description: "Cobro Marco",
              debit: "0.00",
              credit: "2000.00",
              balance: "-2000.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Cobro Marco/i });
    expect(within(row).getByText(/Cobranza \(efectivo\)/i)).toBeInTheDocument();
  });

  it("BF3 — renders 'Pago (efectivo)' for sourceType=payment + paymentDirection=PAGO", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-pag",
              sourceType: "payment",
              paymentDirection: "PAGO",
              voucherTypeHuman: "Comprobante de Egreso",
              paymentMethod: "EFECTIVO",
              description: "Pago proveedor",
              debit: "150.00",
              credit: "0.00",
              balance: "-150.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="PROVEEDOR"
      />,
    );

    const row = screen.getByRole("row", { name: /Pago proveedor/i });
    expect(within(row).getByText(/Pago \(efectivo\)/i)).toBeInTheDocument();
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

  // ── DT — código operacional físico (Marco QA) ──
  //
  // Cobrador necesita leer VG/RC/ND/BC/FL/PF/CG/SV en la columna Tipo en
  // lugar de "Comprobante de Ingreso"/"Cobranza (efectivo)" genéricos.

  it("DT — sourceType=sale + documentTypeCode='VG' → 'VG' (no voucherTypeHuman)", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-vg",
              sourceType: "sale",
              voucherTypeHuman: "Nota de despacho",
              documentTypeCode: "VG",
              description: "Venta general 001",
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

    const row = screen.getByRole("row", { name: /Venta general 001/i });
    expect(within(row).getByText("VG")).toBeInTheDocument();
  });

  it("DT — sourceType=payment + documentTypeCode='RC' + EFECTIVO → 'RC (efectivo)'", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-rc",
              sourceType: "payment",
              paymentDirection: "COBRO",
              paymentMethod: "EFECTIVO",
              documentTypeCode: "RC",
              voucherTypeHuman: "Comprobante de Ingreso",
              description: "Cobro Marcos efectivo",
              debit: "0.00",
              credit: "2000.00",
              balance: "-2000.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Cobro Marcos efectivo/i });
    expect(within(row).getByText(/RC \(efectivo\)/)).toBeInTheDocument();
  });

  it("DT — sourceType=dispatch + documentTypeCode='ND' → 'ND' plano", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-nd",
              sourceType: "dispatch",
              voucherTypeHuman: "Nota de despacho",
              documentTypeCode: "ND",
              description: "Despacho 001",
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

    const row = screen.getByRole("row", { name: /Despacho 001/i });
    expect(within(row).getByText("ND")).toBeInTheDocument();
  });

  it("DT — sourceType=purchase + documentTypeCode='FL' → 'FL' plano", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-fl",
              sourceType: "purchase",
              voucherTypeHuman: "Compra de flete",
              documentTypeCode: "FL",
              description: "Flete proveedor X",
              debit: "0.00",
              credit: "800.00",
              balance: "-800.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="PROVEEDOR"
      />,
    );

    const row = screen.getByRole("row", { name: /Flete proveedor X/i });
    expect(within(row).getByText("FL")).toBeInTheDocument();
  });
});

// ── DT4 — número físico del documento en la columna Nº (QA Marco) ──
//
// El cobrador necesita leer en la columna "Nº" el número del documento físico
// ("VG-0001", "RC-0042", "ND-0005") en vez del correlative voucher contable
// ("I2605-000001"). Fallback al displayNumber cuando documentReferenceNumber
// es null (asiento manual sin auxiliar o Payment sin referenceNumber).

describe("ContactLedgerPageClient — Nº column (DT4 documentReferenceNumber)", () => {
  it("DT4 — sale con documentReferenceNumber='VG-0001' → cell Nº muestra 'VG-0001' (no displayNumber)", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-vg-1",
              sourceType: "sale",
              voucherTypeHuman: "Nota de despacho",
              documentTypeCode: "VG",
              documentReferenceNumber: "VG-0001",
              displayNumber: "D2506-000001",
              description: "Venta general 001",
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

    const row = screen.getByRole("row", { name: /Venta general 001/i });
    // Columns: Fecha | Tipo | Nº | Estado | Desc | Debe | Haber | Saldo. Nº = idx 2.
    const cells = within(row).getAllByRole("cell");
    expect(cells[2].textContent).toBe("VG-0001");
  });

  it("DT4 — payment con documentReferenceNumber='RC-0042' → cell Nº muestra 'RC-0042'", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-rc-42",
              sourceType: "payment",
              paymentDirection: "COBRO",
              paymentMethod: "EFECTIVO",
              voucherTypeHuman: "Comprobante de Ingreso",
              documentTypeCode: "RC",
              documentReferenceNumber: "RC-0042",
              displayNumber: "I2605-000042",
              description: "Cobro Marco RC42",
              debit: "0.00",
              credit: "200.00",
              balance: "-200.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    const row = screen.getByRole("row", { name: /Cobro Marco RC42/i });
    const cells = within(row).getAllByRole("cell");
    expect(cells[2].textContent).toBe("RC-0042");
  });

  it("DT4 — withoutAuxiliary=true + documentReferenceNumber=null → cell Nº cae al displayNumber (asiento manual)", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-manual-1",
              sourceType: null,
              voucherTypeHuman: "Comprobante de Diario",
              documentTypeCode: null,
              documentReferenceNumber: null,
              displayNumber: "A2604-000001",
              description: "Ajuste contable A1",
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

    const row = screen.getByRole("row", { name: /Ajuste contable A1/i });
    const cells = within(row).getAllByRole("cell");
    expect(cells[2].textContent).toBe("A2604-000001");
  });

  it("DT4 — payment sin referenceNumber (documentReferenceNumber=null) → cell Nº cae al displayNumber correlative voucher", () => {
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-rc-noref",
              sourceType: "payment",
              paymentDirection: "COBRO",
              paymentMethod: "EFECTIVO",
              voucherTypeHuman: "Comprobante de Ingreso",
              documentTypeCode: "RC",
              documentReferenceNumber: null, // operador NO capturó referenceNumber
              displayNumber: "I2605-000050",
              description: "Cobro sin referencia fisica",
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

    const row = screen.getByRole("row", { name: /Cobro sin referencia fisica/i });
    const cells = within(row).getAllByRole("cell");
    expect(cells[2].textContent).toBe("I2605-000050");
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
    // Warning text + icon (semantic accessible marker). The Estado cell
    // wraps the label inside a span with aria-label "Sin auxiliar" so we
    // assert the label, then verify the span contains the visible text.
    const warningSpan = within(row).getByLabelText(/sin auxiliar/i);
    expect(warningSpan).toBeInTheDocument();
    expect(warningSpan.textContent).toMatch(/Sin auxiliar/i);
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

    // Saldo cell is the last data cell (index 7) of the 8-column row —
    // scope to that cell explicitly to avoid collisions with Debe / Haber
    // values that share the same currency formatting (Mov A: Debe=100,
    // Saldo=100; Mov C: Haber=30, Saldo=120 — but Mov B Debe=50 vs
    // Saldo=150 would still ambiguity-collide for non-scoped queries).
    const rowA = screen.getByRole("row", { name: /Mov A/i });
    const rowB = screen.getByRole("row", { name: /Mov B/i });
    const rowC = screen.getByRole("row", { name: /Mov C/i });
    expect(within(rowA).getAllByRole("cell")[7].textContent).toMatch(
      /Bs\.\s*100[.,]00/,
    );
    expect(within(rowB).getAllByRole("cell")[7].textContent).toMatch(
      /Bs\.\s*150[.,]00/,
    );
    expect(within(rowC).getAllByRole("cell")[7].textContent).toMatch(
      /Bs\.\s*120[.,]00/,
    );
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

describe("ContactLedgerPageClient — descripción truncate (BF4)", () => {
  it("BF4 — Descripción cell truncates wide text via max-w + truncate + tooltip", () => {
    // BUG #5 cosmético: descripciones largas (ej. "3333333..." que Marco
    // tipeó en QA) rompen el layout horizontal de la tabla. Fix: la cell
    // Descripción debe tener max-w-[300px] + truncate (overflow-hidden +
    // text-ellipsis + whitespace-nowrap) + title attribute con el texto
    // completo para tooltip nativo del browser.
    const longText =
      "33333333333333333333333333333333333333333333333333333333333333";
    render(
      <ContactLedgerPageClient
        orgSlug={ORG_SLUG}
        contacts={makeContacts()}
        ledger={makeLedger({
          total: 1,
          items: [
            makeEntry({
              entryId: "je-long",
              sourceType: "sale",
              voucherTypeHuman: "Nota de Despacho",
              description: longText,
              debit: "100.00",
              credit: "0.00",
              balance: "100.00",
            }),
          ],
        })}
        filters={{ contactId: CONTACT_ID, dateFrom: "2025-06-01", dateTo: "2025-06-30" }}
        typeFilter="CLIENTE"
      />,
    );

    // Find any <td> whose title attribute carries the full long text. The
    // truncate styling hides overflow visually but the title persists for
    // browser-native tooltip.
    const allCells = Array.from(document.querySelectorAll("td"));
    const descCell = allCells.find(
      (c) => c.getAttribute("title") === longText,
    );
    expect(descCell).toBeDefined();
    // Classes assert: max-w bound + truncate utility.
    expect(descCell!.className).toMatch(/max-w-\[300px\]/);
    expect(descCell!.className).toMatch(/\btruncate\b/);
  });
});
