import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/features/shared/errors";
import { LedgerService } from "../ledger.service";
import { InMemoryJournalLedgerQueryPort } from "./fakes/in-memory-accounting-uow";
import type { AccountsCrudPort } from "../../domain/ports/accounts-crud.port";
import type { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { ContactsReadPort } from "../../domain/ports/contacts-read.port";
import type {
  ContactLedgerEnrichmentDeps,
  PayablesContactLedgerPort,
  PaymentsContactLedgerPort,
  ReceivablesContactLedgerPort,
} from "../../domain/ports/contact-ledger-enrichment.ports";
import type { Account } from "@/generated/prisma/client";

/**
 * Behavioral unit test for `LedgerService.getContactLedgerPaginated`
 * (contact-ledger-refactor — C3).
 *
 * RED expected failure mode per [[red_acceptance_failure_mode]]:
 *   `getContactLedgerPaginated` method does not exist on `LedgerService`,
 *   and the supporting types (`ContactLedgerEntry`, `ContactLedgerPaginatedDto`)
 *   + enrichment ports (`ReceivablesContactLedgerPort`,
 *   `PayablesContactLedgerPort`, `PaymentsContactLedgerPort`) are not declared.
 *   Tests fail to compile (TS2339 / TS2305) — the assertion shape mirrors
 *   sister `ledger.service.test.ts` for `getAccountLedgerPaginated`.
 *   Lección C1 applied: RED targets the SAME runtime object that gains the
 *   real behaviour in GREEN (LedgerService instance, not bare-object cast).
 *
 * Covers spec REQ:
 *   - Status derivation (PENDIENTE/PARCIAL/PAGADO + ATRASADO when dueDate
 *     past).
 *   - Tipo human-readable from voucherType.name + sourceType.
 *   - Forma de pago appended for payment sourceType.
 *   - "Sin auxiliar" (withoutAuxiliary) flagging for asiento manual sin
 *     auxiliar (D4 fallback).
 *   - Opening balance row propagation (DEC-1 Decimal precision).
 *   - NotFoundError when contact missing (parity sister `getAccountLedger`).
 *   - Batched enrichment lookups exercise the design D3 N+1 mitigation —
 *     ReceivablesContactLedgerPort.findByJournalEntryIds invoked ONCE with
 *     the dedup'd list of JE ids, NOT once per row.
 */

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeAccountsStub(): AccountsCrudPort {
  const notUsed = () => {
    throw new Error(
      "AccountsCrudPort method not exercised by getContactLedgerPaginated",
    );
  };
  return {
    findById: async () => ({ id: "x" }) as unknown as Account,
    findAll: async () => [],
    findByCode: notUsed,
    findManyByIds: notUsed,
    findTree: notUsed,
    findByType: notUsed,
    findSiblings: notUsed,
    findDetailAccounts: notUsed,
    findDetailChildrenByParentCodes: notUsed,
    findActiveChildren: notUsed,
    create: notUsed,
    update: notUsed,
    seedChartOfAccounts: notUsed,
    deactivate: notUsed,
    countJournalLines: notUsed,
  } as AccountsCrudPort;
}

function makeBalancesStub(): AccountBalancesService {
  return { getBalances: async () => [] } as unknown as AccountBalancesService;
}

/** Contacts port stub. `activeContactIds` defaults empty so the contact
 *  miss path is the default — tests asserting "happy path" must add the id. */
function makeContactsStub(activeContactIds: Set<string>): ContactsReadPort {
  return {
    getActiveById: async (_org, contactId) => {
      if (!activeContactIds.has(contactId)) {
        throw new NotFoundError("Contacto");
      }
    },
  };
}

type ReceivableEnrichmentRow = Awaited<
  ReturnType<ReceivablesContactLedgerPort["findByJournalEntryIds"]>
>[number];

type PayableEnrichmentRow = Awaited<
  ReturnType<PayablesContactLedgerPort["findByJournalEntryIds"]>
>[number];

type PaymentEnrichmentRow = Awaited<
  ReturnType<PaymentsContactLedgerPort["findByJournalEntryIds"]>
>[number];

function makeEnrichmentDeps(opts: {
  contacts: ContactsReadPort;
  receivables?: ReceivableEnrichmentRow[];
  payables?: PayableEnrichmentRow[];
  payments?: PaymentEnrichmentRow[];
  /** Org-wide CxC/CxP control account codes the service uses to scope the
   *  contact-ledger query to control-account movements only. Defaults mirror
   *  the canonical Bolivian chart (1.1.4.1 / 2.1.1.1) so existing tests work
   *  without priming. BF1 — fixes duplicate-rows + running-balance bugs by
   *  filtering out non-control-account contrapartida lines. */
  controlAccountCodes?: { cxcAccountCode: string; cxpAccountCode: string };
}): {
  deps: ContactLedgerEnrichmentDeps;
  receivablesSpy: ReturnType<typeof vi.fn>;
  payablesSpy: ReturnType<typeof vi.fn>;
  paymentsSpy: ReturnType<typeof vi.fn>;
  controlAccountsSpy: ReturnType<typeof vi.fn>;
} {
  const receivablesSpy = vi.fn(async () => opts.receivables ?? []);
  const payablesSpy = vi.fn(async () => opts.payables ?? []);
  const paymentsSpy = vi.fn(async () => opts.payments ?? []);
  const codes = opts.controlAccountCodes ?? {
    cxcAccountCode: "1.1.4.1",
    cxpAccountCode: "2.1.1.1",
  };
  const controlAccountsSpy = vi.fn(async () => codes);
  return {
    deps: {
      contacts: opts.contacts,
      receivables: { findByJournalEntryIds: receivablesSpy },
      payables: { findByJournalEntryIds: payablesSpy },
      payments: { findByJournalEntryIds: paymentsSpy },
      controlAccountCodes: { getControlAccountCodes: controlAccountsSpy },
    },
    receivablesSpy,
    payablesSpy,
    paymentsSpy,
    controlAccountsSpy,
  };
}

function contactRow(opts: {
  debit: number;
  credit: number;
  date: string;
  number: number;
  journalEntryId: string;
  sourceType: string | null;
  sourceId: string | null;
  voucherCode?: string;
  voucherPrefix?: string;
  voucherName?: string;
  description?: string | null;
}) {
  return {
    debit: opts.debit,
    credit: opts.credit,
    description: opts.description ?? null,
    sourceType: opts.sourceType,
    sourceId: opts.sourceId,
    journalEntry: {
      id: opts.journalEntryId,
      date: new Date(opts.date),
      number: opts.number,
      description: `E${opts.number}`,
      voucherType: {
        code: opts.voucherCode ?? "CD",
        prefix: opts.voucherPrefix ?? "D",
        name: opts.voucherName ?? "Comprobante de Diario",
      },
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LedgerService.getContactLedgerPaginated", () => {
  it("T1 running balance Decimal precision: 100.10 + 200.20 - 50.05 = 250.25 exact (DEC-1)", async () => {
    // SPEC: running balance must use decimal.js precision (no Number drift).
    // 100.10 + 200.20 - 50.05 = 250.25 EXACT — Number arithmetic produces
    // 250.24999999999997.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 100.1,
        credit: 0,
        date: "2099-01-01",
        number: 1,
        journalEntryId: "je-1",
        sourceType: null,
        sourceId: null,
      }),
      contactRow({
        debit: 200.2,
        credit: 0,
        date: "2099-01-02",
        number: 2,
        journalEntryId: "je-2",
        sourceType: null,
        sourceId: null,
      }),
      contactRow({
        debit: 0,
        credit: 50.05,
        date: "2099-01-03",
        number: 3,
        journalEntryId: "je-3",
        sourceType: null,
        sourceId: null,
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set(["contact-1"])),
    });
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      deps,
    );

    const result = await service.getContactLedgerPaginated(
      "org-1",
      "contact-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.items.map((e) => e.balance)).toEqual([
      "100.10",
      "300.30",
      "250.25",
    ]);
    expect(result.openingBalance).toBe("0.00");
  });

  it("T2 batched enrichment: ReceivablesContactLedgerPort.findByJournalEntryIds called ONCE with dedup'd ids (N+1 mitigation per design risk #1)", async () => {
    // SPEC: 3 rows reference 2 unique JE ids (je-1 twice + je-2 once).
    // Port MUST be called ONCE with ["je-1", "je-2"] (deduped), NOT once
    // per row.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 100,
        credit: 0,
        date: "2099-01-01",
        number: 1,
        journalEntryId: "je-1",
        sourceType: "sale",
        sourceId: "sale-1",
      }),
      contactRow({
        debit: 0,
        credit: 100,
        date: "2099-01-01",
        number: 1,
        journalEntryId: "je-1",
        sourceType: "sale",
        sourceId: "sale-1",
      }),
      contactRow({
        debit: 200,
        credit: 0,
        date: "2099-01-02",
        number: 2,
        journalEntryId: "je-2",
        sourceType: "sale",
        sourceId: "sale-2",
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps, receivablesSpy, payablesSpy, paymentsSpy } =
      makeEnrichmentDeps({
        contacts: makeContactsStub(new Set(["contact-1"])),
        receivables: [
          {
            journalEntryId: "je-1",
            status: "PENDING",
            dueDate: new Date("2099-12-31"),
          },
          {
            journalEntryId: "je-2",
            status: "PARTIAL",
            dueDate: new Date("2099-12-31"),
          },
        ],
      });
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      deps,
    );

    await service.getContactLedgerPaginated(
      "org-1",
      "contact-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(receivablesSpy).toHaveBeenCalledTimes(1);
    const [orgArg, idsArg] = receivablesSpy.mock.calls[0];
    expect(orgArg).toBe("org-1");
    // Deduped: je-1 + je-2 (order may differ; assert as set)
    expect(new Set(idsArg as string[])).toEqual(new Set(["je-1", "je-2"]));
    // Sister ports also called once each (batched), even if empty
    expect(payablesSpy).toHaveBeenCalledTimes(1);
    expect(paymentsSpy).toHaveBeenCalledTimes(1);
  });

  it("T3 withoutAuxiliary flagging: row with sourceType=null AND no CxC/CxP match flagged true (D4 fallback)", async () => {
    // SPEC REQ "Fallback — Asiento Manual sin Auxiliar": JournalLine with
    // contactId reachable but NO source document → flagged withoutAuxiliary.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 500,
        credit: 0,
        date: "2099-03-15",
        number: 99,
        journalEntryId: "je-orphan",
        sourceType: null,
        sourceId: null,
        description: "Ajuste manual",
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set(["contact-1"])),
      // Empty enrichments: no CxC/CxP/Payment found for je-orphan
      receivables: [],
      payables: [],
      payments: [],
    });
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      deps,
    );

    const result = await service.getContactLedgerPaginated(
      "org-1",
      "contact-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0].withoutAuxiliary).toBe(true);
    expect(result.items[0].status).toBeNull();
  });

  it("T4 opening balance row: port returns openingBalanceDelta=120.50 → DTO openingBalance='120.50' (DEC-1 string serialization)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 30,
        credit: 0,
        date: "2099-02-01",
        number: 10,
        journalEntryId: "je-10",
        sourceType: null,
        sourceId: null,
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 120.5;
    const { deps } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set(["contact-1"])),
    });
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      deps,
    );

    const result = await service.getContactLedgerPaginated(
      "org-1",
      "contact-1",
      { dateFrom: new Date("2099-01-15") },
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.openingBalance).toBe("120.50");
    // Running balance seeded from opening: 120.50 + 30 = 150.50
    expect(result.items[0].balance).toBe("150.50");
  });

  it("BF2-T1 forwards Payment.direction (COBRO|PAGO) to ContactLedgerEntry.paymentDirection (resolves bug #1 Pago vs Cobranza)", async () => {
    // BUG #1: el adapter de Payment ya fetchea `direction` pero el service
    // lo descarta — el DTO `ContactLedgerEntry` no expone el campo, asi que
    // la UI no puede distinguir "Cobranza (efectivo)" vs "Pago (efectivo)"
    // cuando ambos llevan `sourceType="payment"` (producción usa solo
    // "payment", "receipt" no existe runtime).
    // FIX: agregar `paymentDirection: "COBRO"|"PAGO"|null` al DTO,
    // forwardeando desde el enrichment row.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 0,
        credit: 200,
        date: "2099-05-16",
        number: 5,
        journalEntryId: "je-pay",
        sourceType: "payment",
        sourceId: "pay-1",
        voucherCode: "CI",
        voucherPrefix: "I",
        voucherName: "Comprobante de Ingreso",
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set(["contact-1"])),
      payments: [
        {
          journalEntryId: "je-pay",
          paymentMethod: "EFECTIVO",
          bankAccountName: null,
          direction: "COBRO",
        },
      ],
    });
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      deps,
    );

    const result = await service.getContactLedgerPaginated(
      "org-1",
      "contact-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(result.items).toHaveLength(1);
    const entry = result.items[0] as typeof result.items[number] & {
      paymentDirection: string | null;
    };
    expect(entry.paymentDirection).toBe("COBRO");
  });

  it("BF2-T2 paymentDirection=null cuando el row no tiene Payment asociado", async () => {
    // Rows que no son `sourceType="payment"` (sale/purchase/manual) NO tienen
    // payment row → `paymentDirection` debe ser null.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 500,
        credit: 0,
        date: "2099-05-16",
        number: 1,
        journalEntryId: "je-sale",
        sourceType: "sale",
        sourceId: "sale-1",
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set(["contact-1"])),
    });
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      deps,
    );

    const result = await service.getContactLedgerPaginated(
      "org-1",
      "contact-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    const entry = result.items[0] as typeof result.items[number] & {
      paymentDirection: string | null;
    };
    expect(entry.paymentDirection).toBeNull();
  });

  it("BF1-T1 fetches CxC/CxP control account codes ONCE per call and forwards them to the query port (resolves bug #2 duplicate rows / #4 inconsistent status / #6 broken running balance)", async () => {
    // BUG #2/#4/#6 ROOT CAUSE: when a JE has both debit and credit lines
    // tagged with contactId (header surface + line surface dual D4), BOTH
    // lines surface in the contact ledger — once as Debe, once as Haber —
    // because the where clause only filters by contact, not by account.
    // FIX: service fetches org-wide CxC/CxP control account codes and the
    // port query restricts to `account.code IN [cxc, cxp]` so contrapartida
    // lines (Caja, Ventas, etc) are dropped.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps, controlAccountsSpy } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set(["contact-1"])),
      controlAccountCodes: {
        cxcAccountCode: "1.1.4.1",
        cxpAccountCode: "2.1.1.1",
      },
    });
    const findLinesSpy = vi.spyOn(query, "findLinesByContactPaginated");
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      deps,
    );

    await service.getContactLedgerPaginated(
      "org-1",
      "contact-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    expect(controlAccountsSpy).toHaveBeenCalledTimes(1);
    expect(controlAccountsSpy).toHaveBeenCalledWith("org-1");
    // Service forwards accountCodes via the filters bag — adapter narrows.
    expect(findLinesSpy).toHaveBeenCalledTimes(1);
    const filtersArg = findLinesSpy.mock.calls[0][2] as
      | { accountCodes?: string[] }
      | undefined;
    expect(filtersArg?.accountCodes).toBeDefined();
    expect(new Set(filtersArg!.accountCodes!)).toEqual(
      new Set(["1.1.4.1", "2.1.1.1"]),
    );
  });

  it("T5 NotFoundError when contact missing (parity sister `getAccountLedger`)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    const { deps } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set()), // empty — no active contact
    });
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      deps,
    );

    const err = await service
      .getContactLedgerPaginated(
        "org-1",
        "missing-contact",
        undefined,
        undefined,
        { page: 1, pageSize: 25 },
      )
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(NotFoundError);
  });
});
