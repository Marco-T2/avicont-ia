import { describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/modules/shared/domain/errors";
import { LedgerService } from "../ledger.service";
import { InMemoryJournalLedgerQueryPort } from "./fakes/in-memory-accounting-uow";
import type { AccountsCrudPort } from "../../domain/ports/accounts-crud.port";
import type { AccountBalancesService } from "@/modules/account-balances/application/account-balances.service";
import type { ContactsReadPort } from "../../domain/ports/contacts-read.port";
import type {
  ContactLedgerEnrichmentDeps,
  PaymentsContactLedgerPort,
} from "../../domain/ports/contact-ledger-enrichment.ports";
import type { Account } from "../../domain/accounts.types";

/**
 * Behavioral unit test for `LedgerService.getContactLedgerPaginated`
 * (contact-ledger-refactor — C3).
 *
 * RED expected failure mode per [[red_acceptance_failure_mode]] (historical,
 * contact-ledger-refactor C3):
 *   `getContactLedgerPaginated` method does not exist on `LedgerService`,
 *   and the supporting types (`ContactLedgerEntry`, `ContactLedgerPaginatedDto`)
 *   + enrichment ports were not declared.
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
 *     PaymentsContactLedgerPort.findByJournalEntryIds invoked ONCE with
 *     the dedup'd list of JE ids, NOT once per row.
 *
 * unified-comprobante-source-of-truth P9 (D6 retirement 3→1): the CxC/CxP
 * enrichment arms are RETIRED — estado/dueDate are sourced from the JE row
 * ONLY (`journalEntry.paymentStatus` / `journalEntry.dueDate`, stamped at
 * creation + live-synced by the repo write funnel + backfilled P7). The
 * payments enrichment SURVIVES (paymentMethod/bankAccountName/direction are
 * not on the JE). P8's transitional fallback pins were rewritten here to
 * assert the post-retirement reality (JE-sourced or null → UI "—").
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

type PaymentEnrichmentRow = Awaited<
  ReturnType<PaymentsContactLedgerPort["findByJournalEntryIds"]>
>[number];

function makeEnrichmentDeps(opts: {
  contacts: ContactsReadPort;
  payments?: PaymentEnrichmentRow[];
  /** Org-wide CxC/CxP control account codes the service uses to scope the
   *  contact-ledger query to control-account movements only. Defaults mirror
   *  the canonical Bolivian chart (1.1.4.1 / 2.1.1.1) so existing tests work
   *  without priming. BF1 — fixes duplicate-rows + running-balance bugs by
   *  filtering out non-control-account contrapartida lines. */
  controlAccountCodes?: { cxcAccountCode: string; cxpAccountCode: string };
}): {
  deps: ContactLedgerEnrichmentDeps;
  paymentsSpy: ReturnType<typeof vi.fn>;
  controlAccountsSpy: ReturnType<typeof vi.fn>;
} {
  const paymentsSpy = vi.fn(async () => opts.payments ?? []);
  const codes = opts.controlAccountCodes ?? {
    cxcAccountCode: "1.1.4.1",
    cxpAccountCode: "2.1.1.1",
  };
  const controlAccountsSpy = vi.fn(async () => codes);
  return {
    deps: {
      contacts: opts.contacts,
      payments: { findByJournalEntryIds: paymentsSpy },
      controlAccountCodes: { getControlAccountCodes: controlAccountsSpy },
    },
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
  /** journal-physical-document Phase 5 — physical doc-type code that the
   *  service reads off the JE row directly (no longer from enrichment
   *  precedence). Pass undefined → row has no doc type → DTO surfaces null. */
  operationalDocCode?: string | null;
  /** Physical document number lifted off JournalEntry.referenceNumber. Same
   *  rationale as operationalDocCode — denormalized in Phase 5. */
  referenceNumber?: number | null;
  /** unified-comprobante-source-of-truth P8 (D6) — persisted settlement
   *  status carried on the JE row itself. Undefined → null (manual JEs /
   *  not-yet-backfilled rows) → service falls back to enrichment. */
  paymentStatus?: string | null;
  /** JE-persisted dueDate sister of paymentStatus (same D6 flip). */
  jeDueDate?: Date | null;
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
      // Denormalized doc-type from the JE row (Phase 5 select). Null when the
      // caller doesn't specify — mirrors legacy/manual entries with no
      // operationalDocTypeId set.
      operationalDocType:
        opts.operationalDocCode != null
          ? { code: opts.operationalDocCode }
          : null,
      referenceNumber: opts.referenceNumber ?? null,
      // P8 (D6) — JE-persisted settlement fields. Default null mirrors
      // manual/not-yet-backfilled JEs so pre-P8 tests keep exercising the
      // enrichment fallback path unchanged.
      paymentStatus: opts.paymentStatus ?? null,
      dueDate: opts.jeDueDate ?? null,
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

  it("T2 batched enrichment: PaymentsContactLedgerPort.findByJournalEntryIds called ONCE with dedup'd ids (N+1 mitigation per design risk #1)", async () => {
    // SPEC: 3 rows reference 2 unique JE ids (je-1 twice + je-2 once).
    // Port MUST be called ONCE with ["je-1", "je-2"] (deduped), NOT once
    // per row. P9: payments is the ONLY surviving enrichment lookup —
    // estado/dueDate come off the JE row, no CxC/CxP ports exist anymore.
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
        paymentStatus: "PENDING",
        jeDueDate: new Date("2099-12-31"),
      }),
      contactRow({
        debit: 0,
        credit: 100,
        date: "2099-01-01",
        number: 1,
        journalEntryId: "je-1",
        sourceType: "sale",
        sourceId: "sale-1",
        paymentStatus: "PENDING",
        jeDueDate: new Date("2099-12-31"),
      }),
      contactRow({
        debit: 200,
        credit: 0,
        date: "2099-01-02",
        number: 2,
        journalEntryId: "je-2",
        sourceType: "sale",
        sourceId: "sale-2",
        paymentStatus: "PARTIAL",
        jeDueDate: new Date("2099-12-31"),
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps, paymentsSpy } = makeEnrichmentDeps({
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

    expect(paymentsSpy).toHaveBeenCalledTimes(1);
    const [orgArg, idsArg] = paymentsSpy.mock.calls[0];
    expect(orgArg).toBe("org-1");
    // Deduped: je-1 + je-2 (order may differ; assert as set)
    expect(new Set(idsArg as string[])).toEqual(new Set(["je-1", "je-2"]));
    // estado sourced straight off the JE rows (P9 — no CxC lookup involved)
    expect(result.items.map((e) => e.status)).toEqual([
      "PENDING",
      "PENDING",
      "PARTIAL",
    ]);
  });

  it("P9-T1 retirement 3→1: retired CxC/CxP enrichment arms are NEVER called — payments is the single surviving lookup with its fields intact (D6)", async () => {
    // unified-comprobante-source-of-truth P9. Deps shrank to
    // contacts/payments/controlAccountCodes; this test additionally attaches
    // legacy-shaped `receivables`/`payables` spies to the deps object (extra
    // structural props — allowed at runtime) and pins that the service never
    // touches them. RED EFM per tasks 9.2: pre-retirement the Promise.all
    // arms still call both spies → toHaveBeenCalledTimes(0) fails.
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
      }),
      contactRow({
        debit: 500,
        credit: 0,
        date: "2099-05-17",
        number: 6,
        journalEntryId: "je-sale",
        sourceType: "sale",
        sourceId: "sale-1",
        paymentStatus: "PAID",
        jeDueDate: new Date("2099-11-30T00:00:00.000Z"),
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps, paymentsSpy } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set(["contact-1"])),
      payments: [
        {
          journalEntryId: "je-pay",
          paymentMethod: "TRANSFERENCIA",
          bankAccountName: "BNB Cta Cte",
          direction: "COBRO",
        },
      ],
    });
    const retiredReceivablesSpy = vi.fn(async () => []);
    const retiredPayablesSpy = vi.fn(async () => []);
    // Variable (not literal) → no TS excess-property check; the runtime
    // object carries the legacy arms so a lingering Promise.all arm WOULD
    // find and call them — the 0-call pins below prove the arms are gone.
    const depsWithRetiredArms = {
      ...deps,
      receivables: { findByJournalEntryIds: retiredReceivablesSpy },
      payables: { findByJournalEntryIds: retiredPayablesSpy },
    };
    const service = new LedgerService(
      query,
      makeAccountsStub(),
      makeBalancesStub(),
      depsWithRetiredArms,
    );

    const result = await service.getContactLedgerPaginated(
      "org-1",
      "contact-1",
      undefined,
      undefined,
      { page: 1, pageSize: 25 },
    );

    // Retired arms: never called (single-lookup enrichment, D6 3→1).
    expect(retiredReceivablesSpy).toHaveBeenCalledTimes(0);
    expect(retiredPayablesSpy).toHaveBeenCalledTimes(0);
    // Surviving payments lookup: called once, fields intact on the DTO.
    expect(paymentsSpy).toHaveBeenCalledTimes(1);
    const payRow = result.items[0] as (typeof result.items)[number] & {
      paymentDirection: string | null;
    };
    expect(payRow.paymentMethod).toBe("TRANSFERENCIA");
    expect(payRow.bankAccountName).toBe("BNB Cta Cte");
    expect(payRow.paymentDirection).toBe("COBRO");
    // JE-sourced estado for the linked row (no CxC lookup involved).
    expect(result.items[1].status).toBe("PAID");
    expect(result.items[1].dueDate).toBe("2099-11-30T00:00:00.000Z");
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
      // Empty payments enrichment: no Payment found for je-orphan. P9: the
      // "no auxiliar" signal is the JE row itself (paymentStatus null).
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

  // ── DocumentTypeCode propagation (QA Marco — operational doc code físico) ──
  //
  // El cobrador necesita leer en la columna "Tipo" el código del documento
  // físico (VG, RC, ND, BC, FL, etc.) para saber qué documento ir a buscar.
  // El service forwardea `documentTypeCode` desde el enrichment row al DTO.
  // sourceType=manual o sin auxiliar → null (UI muestra "Ajuste").

  it("DT-T1 propagates Payment documentTypeCode (org-configurable code, p.ej. 'RC') al ContactLedgerEntry", async () => {
    // journal-physical-document Phase 5: doc-type code now read off the JE
    // row directly (not from Payment enrichment). The Payment composition
    // root populates JournalEntry.operationalDocTypeId at JE creation; the
    // ledger query select hydrates `operationalDocType.code`.
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
        operationalDocCode: "RC",
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

    const entry = result.items[0] as typeof result.items[number] & {
      documentTypeCode: string | null;
    };
    expect(entry.documentTypeCode).toBe("RC");
  });

  it("DT-T2 propagates documentTypeCode='VG' para sourceType=sale (Sale composition root resolves 'VG' via findByCode at JE creation)", async () => {
    // Post-Phase-5: Sale factory adapter sets JE.operationalDocTypeId via
    // OperationalDocTypesRepository.findByCode(orgId, 'VG'). Ledger reads
    // the code off the row — no Sale.findMany lookup in enrichment.
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
        operationalDocCode: "VG",
        paymentStatus: "PENDING",
        jeDueDate: new Date("2099-12-31"),
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
      documentTypeCode: string | null;
    };
    expect(entry.documentTypeCode).toBe("VG");
  });

  it("DT-T3 propagates documentTypeCode para sourceType=dispatch (Dispatch composition root resolves 'ND'/'BC' via dispatchTypeToCode + findByCode)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 800,
        credit: 0,
        date: "2099-05-16",
        number: 1,
        journalEntryId: "je-dispatch",
        sourceType: "dispatch",
        sourceId: "disp-1",
        operationalDocCode: "ND",
        paymentStatus: "PENDING",
        jeDueDate: new Date("2099-12-31"),
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
      documentTypeCode: string | null;
    };
    expect(entry.documentTypeCode).toBe("ND");
  });

  it("DT-T4 propagates documentTypeCode para sourceType=purchase (Purchase unit of work resolves 'FL'/'PF'/'CG'/'SV' via purchaseTypeToCode + findByCode)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 0,
        credit: 1500,
        date: "2099-05-16",
        number: 1,
        journalEntryId: "je-purchase",
        sourceType: "purchase",
        sourceId: "purch-1",
        operationalDocCode: "FL",
        paymentStatus: "PENDING",
        jeDueDate: new Date("2099-12-31"),
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
      documentTypeCode: string | null;
    };
    expect(entry.documentTypeCode).toBe("FL");
  });

  it("DT-T5 documentTypeCode=null para asiento manual sin auxiliar (UI muestra 'Ajuste')", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 500,
        credit: 0,
        date: "2099-05-16",
        number: 99,
        journalEntryId: "je-manual",
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

    const entry = result.items[0] as typeof result.items[number] & {
      documentTypeCode: string | null;
    };
    expect(entry.documentTypeCode).toBeNull();
    expect(entry.withoutAuxiliary).toBe(true);
  });

  // ── DocumentReferenceNumber propagation (DT4 — QA Marco) ──
  //
  // El cobrador necesita leer en la columna "Nº" el número del documento
  // físico ("1", "42", "ND-0005") en vez del correlative voucher
  // contable. El adapter formatea `${code}-${seq padded(4)}` y devuelve el
  // string en el enrichment row; el service sólo lo forwardea al DTO.
  // Fallback: null en el enrichment row → null en el DTO → UI cae al
  // displayNumber.

  it("DT4-T1 propagates documentReferenceNumber from JE row (e.g. '42') al ContactLedgerEntry", async () => {
    // journal-physical-document Phase 5: referenceNumber denormalized to the
    // JE row, formatted via formatDocumentReferenceNumber (sequence-only —
    // no prefix, no padding per DT4 lock).
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
        operationalDocCode: "RC",
        referenceNumber: 42,
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

    const entry = result.items[0] as typeof result.items[number] & {
      documentReferenceNumber: string | null;
    };
    expect(entry.documentReferenceNumber).toBe("42");
  });

  it("DT4-T2 propagates documentReferenceNumber='1' from JE row para sourceType=sale", async () => {
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
        operationalDocCode: "VG",
        referenceNumber: 1,
        paymentStatus: "PENDING",
        jeDueDate: new Date("2099-12-31"),
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
      documentReferenceNumber: string | null;
    };
    expect(entry.documentReferenceNumber).toBe("1");
  });

  it("DT4-T3 propagates documentReferenceNumber='5' from JE row para sourceType=purchase", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 0,
        credit: 1500,
        date: "2099-05-16",
        number: 1,
        journalEntryId: "je-purchase",
        sourceType: "purchase",
        sourceId: "purch-1",
        operationalDocCode: "FL",
        referenceNumber: 5,
        paymentStatus: "PENDING",
        jeDueDate: new Date("2099-12-31"),
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
      documentReferenceNumber: string | null;
    };
    expect(entry.documentReferenceNumber).toBe("5");
  });

  it("DT4-T4 documentReferenceNumber=null para asiento manual sin auxiliar (UI cae al displayNumber)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 500,
        credit: 0,
        date: "2099-05-16",
        number: 99,
        journalEntryId: "je-manual",
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

    const entry = result.items[0] as typeof result.items[number] & {
      documentReferenceNumber: string | null;
    };
    expect(entry.documentReferenceNumber).toBeNull();
  });

  it("DT4-T5 documentReferenceNumber=null para Payment sin referenceNumber (fallback semantics — UI cae al displayNumber)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 0,
        credit: 100,
        date: "2099-05-16",
        number: 50,
        journalEntryId: "je-pay-noref",
        sourceType: "payment",
        sourceId: "pay-50",
      }),
    ];
    query.openingBalanceDeltaByContactPrimed = 0;
    const { deps } = makeEnrichmentDeps({
      contacts: makeContactsStub(new Set(["contact-1"])),
      payments: [
        {
          journalEntryId: "je-pay-noref",
          paymentMethod: "EFECTIVO",
          bankAccountName: null,
          direction: "COBRO", // operador NO capturó referenceNumber
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

    const entry = result.items[0] as typeof result.items[number] & {
      documentReferenceNumber: string | null;
    };
    expect(entry.documentReferenceNumber).toBeNull();
  });

  // ── P8 read-path flip → P9 retirement (unified-comprobante, D6) ──
  //
  // JE.paymentStatus/JE.dueDate are the estado source of truth. P9 retired
  // the CxC/CxP enrichment arms entirely: JE-linked rows are ALWAYS stamped
  // (creation stamp P3/P4 + live sync + P7 backfill; re-verified at
  // retirement by the STEP-0 fallback-dependency guard = 0 rows), manual JEs
  // carry null → UI renders "—" (spec null-em-dash). ATRASADO stays
  // read-derived (UI/exporters derive from dueDate < now) — never persisted.
  //
  // P8-T3's transitional fallback pin was REWRITTEN at P9 (per apply-progress
  // note: it asserted removed behavior) — it now pins the post-retirement
  // reality: paymentStatus=null → null estado even for source-linked rows.

  it("P8-T1 estado sourced from JE.paymentStatus — the JE row is the only estado source (D6, P9)", async () => {
    // JE says PAID/2099-11-30 → DTO surfaces BOTH fields from the JE.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 500,
        credit: 0,
        date: "2099-05-16",
        number: 1,
        journalEntryId: "je-flip",
        sourceType: "sale",
        sourceId: "sale-1",
        paymentStatus: "PAID",
        jeDueDate: new Date("2099-11-30T00:00:00.000Z"),
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

    expect(result.items[0].status).toBe("PAID");
    expect(result.items[0].dueDate).toBe("2099-11-30T00:00:00.000Z");
  });

  it("P8-T2 triangulation payable side: JE.paymentStatus=VOIDED sourced off the JE row (sister parity)", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 0,
        credit: 1500,
        date: "2099-05-16",
        number: 2,
        journalEntryId: "je-flip-ap",
        sourceType: "purchase",
        sourceId: "purch-1",
        paymentStatus: "VOIDED",
        jeDueDate: new Date("2099-10-01T00:00:00.000Z"),
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

    expect(result.items[0].status).toBe("VOIDED");
    expect(result.items[0].dueDate).toBe("2099-10-01T00:00:00.000Z");
  });

  it("P8-T3 REWRITTEN at P9 — fallback retired: JE.paymentStatus=null renders null estado even for a source-linked row (spec null-em-dash)", async () => {
    // Pre-P9 this test pinned the transitional enrichment fallback (null
    // paymentStatus → CxC status PARTIAL). The fallback is GONE: a null
    // paymentStatus now surfaces null estado/dueDate — the UI renders "—".
    // Unreachable for real linked rows in prod (STEP-0 fallback-dependency
    // guard = 0 backfilled-but-null linked JEs; write funnel stamps at
    // creation), pinned here as the service contract for the null branch.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 700,
        credit: 0,
        date: "2099-05-16",
        number: 3,
        journalEntryId: "je-legacy",
        sourceType: "sale",
        sourceId: "sale-9",
        // paymentStatus omitted → contactRow defaults null.
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

    expect(result.items[0].status).toBeNull();
    expect(result.items[0].dueDate).toBeNull();
    // sourceType="sale" → NOT flagged withoutAuxiliary (flag is for manual
    // JEs only — sourceType null AND unstamped JE).
    expect(result.items[0].withoutAuxiliary).toBe(false);
  });

  it("P8-T4 manual JE pin: paymentStatus=null AND no enrichment → status/dueDate null + withoutAuxiliary", async () => {
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 100,
        credit: 0,
        date: "2099-05-16",
        number: 4,
        journalEntryId: "je-manual-p8",
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

    expect(result.items[0].status).toBeNull();
    expect(result.items[0].dueDate).toBeNull();
    expect(result.items[0].withoutAuxiliary).toBe(true);
  });

  it("P8-T5 DTO shape sentinel: ContactLedgerEntry keys byte-identical pre/post flip (zero UI/exporter edits)", async () => {
    // The flip changes WHERE status/dueDate come from, never the DTO shape.
    // Exact key-set pin (sorted) — any added/removed/renamed field breaks
    // the "zero UI/PDF/XLSX edits" D6 contract and must escalate.
    const query = new InMemoryJournalLedgerQueryPort();
    query.linesByContactPaginated = [
      contactRow({
        debit: 100,
        credit: 0,
        date: "2099-05-16",
        number: 5,
        journalEntryId: "je-shape",
        sourceType: "sale",
        sourceId: "sale-1",
        paymentStatus: "PAID",
        jeDueDate: new Date("2099-11-30T00:00:00.000Z"),
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

    expect(Object.keys(result.items[0]).sort()).toEqual([
      "balance",
      "bankAccountName",
      "credit",
      "date",
      "debit",
      "description",
      "documentReferenceNumber",
      "documentTypeCode",
      "dueDate",
      "entryId",
      "entryNumber",
      "paymentDirection",
      "paymentMethod",
      "sourceType",
      "status",
      "voucherCode",
      "voucherTypeHuman",
      "withoutAuxiliary",
    ]);
  });
});
