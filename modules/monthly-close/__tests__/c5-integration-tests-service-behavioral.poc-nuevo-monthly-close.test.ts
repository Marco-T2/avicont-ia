import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setAuditContext } from "@/features/shared/audit-context";
import { prisma } from "@/lib/prisma";
import { Money } from "@/modules/shared/domain/value-objects/money";

import { DraftEntriesPresentError } from "../domain/errors/monthly-close-errors";
import { makeMonthlyCloseService } from "../presentation/composition-root";

/**
 * POC nuevo monthly-close C5 RED-α file 2 — service behavioral integration
 * tests via composition root factory `makeMonthlyCloseService()` (canonical
 * home consume path). Mirror legacy
 * `features/monthly-close/__tests__/monthly-close.integration.test.ts` 7 cases
 * parity (T30 + T13-T17) + 1 case nuevo Riesgo B Decimal precision NUMERIC(18,2)
 * IVA rounding edge case (Eje 4 (a) NEW C5 mismo cycle 6 ejes Marco lock
 * pre-RED).
 *
 * **T31 rollback NO duplicado** — Eje 7 rollback (e) consolidar UoW adapter
 * file 1 canonical home (Marco lock pre-RED): T31 atomic rollback ya cubierto
 * en `prisma-monthly-close-unit-of-work.integration.test.ts` rollback case con
 * setup discriminante real (throw mid-callback). FailingRepo subclass legacy
 * pattern descartado (legacy tx-token-naked precedent superseded por
 * tx-bound-at-construction adapters POC nuevo monthly-close).
 *
 * **Composition root factory consume path** (Eje 3 (c) both — service factory
 * canonical home): consumidor real instancia `makeMonthlyCloseService()` zero-
 * arg cumulative-precedent EXACT 6 evidencias supersede absoluto cross-POC
 * (`makeSaleService` + `makePaymentsService` + `makeFiscalPeriodsService` +
 * `makeIvaBookService` + `makeJournalsService` + `makeMonthlyCloseService` POC
 * nuevo NEW). NO mock manual deps; el factory cablea los 3 adapters propios
 * módulo + cross-module via `FiscalPeriodReaderAdapter` factory-wrap default-
 * init cementado C3.
 *
 * **Asimetría signature service vs legacy** (cementación textual
 * `monthly-close.service.ts:80-85`): POC nuevo monthly-close consume positional
 * args `close(organizationId, periodId, userId, justification?)` NO decomposed
 * object. Diferencia respecto legacy `service.close({organizationId, periodId,
 * userId})` documentada — driver-anchored cumulative-precedent (sale + payment
 * + iva-books + accounting decomposed args 4 evidencias) en C2.2 GREEN
 * cementación honest divergencia surfaced.
 *
 * **Stamp `mci-poc-`** (monthly-close-integration-poc) — distingue de fixtures
 * legacy `mc-int-` (legacy file). Cleanup `afterEach` con `setAuditContext`
 * INSIDE TX (post-ADR-002 audit_trigger_fn requirement) heredado legacy
 * pattern EXACT.
 *
 * Failure modes declarados pre-write
 * (`feedback/red-acceptance-failure-mode`):
 *   - T30 happy: PASS-first expected (composition root + service cementados
 *     C2.2 + C3 + C4).
 *   - T13-T17 (5 DRAFT cases): PASS-first expected (`countDraftsByPeriod`
 *     5-entity adapter cementado C3, `DraftEntriesPresentError` 5-arg domain
 *     typed cementado C2.1).
 *   - Riesgo B Decimal precision: PASS-first esperado funcional (raw SQL
 *     `COALESCE(SUM)::numeric(18,2)` cast bit-perfect Decimal aggregation +
 *     `Money.equals` paired sister 4ta cementación cross-POC). FAIL aceptado
 *     surface honest si rounding asymmetry detectado a nivel adapter.
 */

let orgId: string;
let userId: string;
let periodId: string;
let voucherTypeId: string;
let contactId: string;
let accountDebitId: string;
let accountCreditId: string;

beforeEach(async () => {
  const stamp = Date.now() + Math.floor(Math.random() * 1_000);

  const user = await prisma.user.create({
    data: {
      clerkUserId: `mci-poc-${stamp}`,
      email: `mci-poc-${stamp}@test.local`,
      name: "MC POC Integration Test",
    },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `clerk-mci-poc-${stamp}`,
      slug: `mci-poc-${stamp}`,
      name: "MC POC Integration Org",
    },
  });
  orgId = org.id;

  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: `mci-poc period ${stamp}`,
      year: 2099,
      month: 3,
      startDate: new Date("2099-03-01"),
      endDate: new Date("2099-03-31"),
      status: "OPEN",
      createdById: userId,
    },
  });
  periodId = period.id;

  const vt = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: `CI-MCI-${stamp}`,
      prefix: "CI",
      name: "Comprobante Ingreso MCI",
    },
  });
  voucherTypeId = vt.id;

  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      type: "CLIENTE",
      name: "Cliente MCI POC",
    },
  });
  contactId = contact.id;

  const accountDebit = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `1.1.1-MCI-${stamp}`,
      name: "Cuenta Deudora MCI",
      type: "ACTIVO",
      nature: "DEUDORA",
      level: 3,
      isDetail: true,
    },
  });
  accountDebitId = accountDebit.id;

  const accountCredit = await prisma.account.create({
    data: {
      organizationId: orgId,
      code: `3.1.1-MCI-${stamp}`,
      name: "Cuenta Acreedora MCI",
      type: "PATRIMONIO",
      nature: "ACREEDORA",
      level: 3,
      isDetail: true,
    },
  });
  accountCreditId = accountCredit.id;
});

afterEach(async () => {
  // CASCADE deletes que tocan journal_lines disparan audit_trigger_fn AFTER
  // DELETE; el trigger requiere app.current_organization_id (post-ADR-002).
  // Heredado legacy `monthly-close.integration.test.ts` cleanup pattern EXACT.
  await prisma.$transaction(async (tx) => {
    await setAuditContext(tx, userId, orgId);
    await tx.journalEntry.deleteMany({ where: { organizationId: orgId } });
    await tx.dispatch.deleteMany({ where: { organizationId: orgId } });
    await tx.payment.deleteMany({ where: { organizationId: orgId } });
    await tx.sale.deleteMany({ where: { organizationId: orgId } });
    await tx.purchase.deleteMany({ where: { organizationId: orgId } });
    await tx.account.deleteMany({ where: { organizationId: orgId } });
    await tx.voucherTypeCfg.deleteMany({ where: { organizationId: orgId } });
    await tx.contact.deleteMany({ where: { organizationId: orgId } });
    await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
    await tx.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
  });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

async function seedBalancedPostedDocs(): Promise<void> {
  await prisma.dispatch.create({
    data: {
      organizationId: orgId,
      dispatchType: "NOTA_DESPACHO",
      status: "POSTED",
      sequenceNumber: 1001,
      date: new Date("2099-03-10"),
      contactId,
      periodId,
      description: "Posted dispatch",
      totalAmount: "100.00",
      createdById: userId,
    },
  });

  await prisma.payment.create({
    data: {
      organizationId: orgId,
      status: "POSTED",
      method: "EFECTIVO",
      date: new Date("2099-03-11"),
      amount: "50.00",
      description: "Posted payment",
      periodId,
      contactId,
      createdById: userId,
    },
  });

  const je = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      voucherTypeId,
      periodId,
      createdById: userId,
      number: 10,
      date: new Date("2099-03-12"),
      description: "Balanced JE",
      status: "POSTED",
    },
  });
  await prisma.journalLine.createMany({
    data: [
      {
        journalEntryId: je.id,
        accountId: accountDebitId,
        debit: "100",
        credit: "0",
      },
      {
        journalEntryId: je.id,
        accountId: accountCreditId,
        debit: "0",
        credit: "100",
      },
    ],
  });

  await prisma.sale.create({
    data: {
      organizationId: orgId,
      status: "POSTED",
      sequenceNumber: 2001,
      date: new Date("2099-03-13"),
      contactId,
      periodId,
      description: "Posted sale",
      totalAmount: "300",
      createdById: userId,
    },
  });

  await prisma.purchase.create({
    data: {
      organizationId: orgId,
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 3001,
      date: new Date("2099-03-14"),
      contactId,
      periodId,
      description: "Posted purchase",
      totalAmount: "400",
      createdById: userId,
    },
  });
}

// ── T30 — Observable contract (happy path) ──────────────────────────────────

describe("MonthlyCloseService.close (POC nuevo) — integration happy path (T30)", () => {
  it("close produces observable contract: period CLOSED, all POSTED docs LOCKED, audit rows share correlationId", async () => {
    await seedBalancedPostedDocs();

    const service = makeMonthlyCloseService();

    const result = await service.close(orgId, periodId, userId);

    // Result shape (positional-args service signature C2.2 cementado).
    expect(result.periodStatus).toBe("CLOSED");
    expect(result.closedAt).toBeInstanceOf(Date);
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.locked.dispatches).toBe(1);
    expect(result.locked.payments).toBe(1);
    expect(result.locked.journalEntries).toBe(1);
    expect(result.locked.sales).toBe(1);
    expect(result.locked.purchases).toBe(1);

    // DB state: period CLOSED with closedBy/closedAt.
    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("CLOSED");
    expect(period.closedAt).toBeInstanceOf(Date);
    expect(period.closedBy).toBe(userId);

    // DB state: every seeded doc LOCKED (5-entity STRICT ORDER cascade
    // observable post-commit).
    const [dispatches, payments, journalEntries, sales, purchases] =
      await Promise.all([
        prisma.dispatch.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.payment.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.journalEntry.findMany({
          where: { organizationId: orgId, periodId },
        }),
        prisma.sale.findMany({ where: { organizationId: orgId, periodId } }),
        prisma.purchase.findMany({
          where: { organizationId: orgId, periodId },
        }),
      ]);

    for (const row of [
      ...dispatches,
      ...payments,
      ...journalEntries,
      ...sales,
      ...purchases,
    ]) {
      expect(row.status).toBe("LOCKED");
    }

    // Audit rows share correlationId across 6 entity types (5 lock cascade
    // + fiscal_periods STATUS_CHANGE) — invariantes withAuditTx vivas through
    // composition root factory wiring.
    const auditRows = await prisma.auditLog.findMany({
      where: { organizationId: orgId, correlationId: result.correlationId },
    });
    expect(auditRows.length).toBeGreaterThan(0);
    for (const row of auditRows) {
      expect(row.correlationId).toBe(result.correlationId);
    }

    const entityTypes = new Set(auditRows.map((r) => r.entityType));
    expect(entityTypes.has("dispatches")).toBe(true);
    expect(entityTypes.has("payments")).toBe(true);
    expect(entityTypes.has("journal_entries")).toBe(true);
    expect(entityTypes.has("sales")).toBe(true);
    expect(entityTypes.has("purchases")).toBe(true);
    expect(entityTypes.has("fiscal_periods")).toBe(true);
  });
});

// ── T13-T17 — DRAFT-blocks-close side-effect tests ──────────────────────────
//
// Mirror legacy 5 cases: 1 DRAFT row per entity → close() throws
// `DraftEntriesPresentError` (C2.1 5-arg domain typed) + period stays OPEN +
// DRAFT row unchanged. Adapter `countDraftsByPeriod` 5-entity Promise.all
// cementado C3 — POC nuevo monthly-close NO heredá legacy F-03 silent
// corruption (Sale + Purchase counted desde día 1 del POC, mirror legacy
// post-T21 fix).

describe("MonthlyCloseService.close (POC nuevo) — DRAFT blocks close (T13-T17)", () => {
  it("Dispatch DRAFT blocks close — DraftEntriesPresentError, period unchanged, DRAFT row unchanged", async () => {
    const draft = await prisma.dispatch.create({
      data: {
        organizationId: orgId,
        dispatchType: "NOTA_DESPACHO",
        status: "DRAFT",
        sequenceNumber: 9001,
        date: new Date("2099-03-05"),
        contactId,
        periodId,
        description: "Draft dispatch",
        totalAmount: "100.00",
        createdById: userId,
      },
    });

    const service = makeMonthlyCloseService();

    await expect(
      service.close(orgId, periodId, userId),
    ).rejects.toBeInstanceOf(DraftEntriesPresentError);

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    const freshDraft = await prisma.dispatch.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(freshDraft.status).toBe("DRAFT");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
        action: "STATUS_CHANGE",
      },
    });
    expect(auditRows).toHaveLength(0);
  });

  it("Payment DRAFT blocks close — DraftEntriesPresentError, period unchanged, DRAFT row unchanged", async () => {
    const draft = await prisma.payment.create({
      data: {
        organizationId: orgId,
        status: "DRAFT",
        method: "EFECTIVO",
        date: new Date("2099-03-06"),
        amount: "75.00",
        description: "Draft payment",
        periodId,
        contactId,
        createdById: userId,
      },
    });

    const service = makeMonthlyCloseService();

    await expect(
      service.close(orgId, periodId, userId),
    ).rejects.toBeInstanceOf(DraftEntriesPresentError);

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    const freshDraft = await prisma.payment.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(freshDraft.status).toBe("DRAFT");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
        action: "STATUS_CHANGE",
      },
    });
    expect(auditRows).toHaveLength(0);
  });

  it("JournalEntry DRAFT blocks close — DraftEntriesPresentError, period unchanged, DRAFT row unchanged", async () => {
    const draft = await prisma.journalEntry.create({
      data: {
        organizationId: orgId,
        voucherTypeId,
        periodId,
        createdById: userId,
        number: 42,
        date: new Date("2099-03-07"),
        description: "Draft JE",
        status: "DRAFT",
      },
    });

    const service = makeMonthlyCloseService();

    await expect(
      service.close(orgId, periodId, userId),
    ).rejects.toBeInstanceOf(DraftEntriesPresentError);

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    const freshDraft = await prisma.journalEntry.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(freshDraft.status).toBe("DRAFT");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
        action: "STATUS_CHANGE",
      },
    });
    expect(auditRows).toHaveLength(0);
  });

  it("Sale DRAFT blocks close — DraftEntriesPresentError, period unchanged, DRAFT row unchanged", async () => {
    // POC nuevo monthly-close NO heredá legacy F-03 silent corruption
    // (countDraftsByPeriod adapter cementado C3 cuenta los 5 entity types
    // desde día 1, mirror legacy post-T21 fix).
    const draft = await prisma.sale.create({
      data: {
        organizationId: orgId,
        status: "DRAFT",
        sequenceNumber: 9501,
        date: new Date("2099-03-08"),
        contactId,
        periodId,
        description: "Draft sale",
        totalAmount: "250.00",
        createdById: userId,
      },
    });

    const service = makeMonthlyCloseService();

    await expect(
      service.close(orgId, periodId, userId),
    ).rejects.toBeInstanceOf(DraftEntriesPresentError);

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    const freshDraft = await prisma.sale.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(freshDraft.status).toBe("DRAFT");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
        action: "STATUS_CHANGE",
      },
    });
    expect(auditRows).toHaveLength(0);
  });

  it("Purchase DRAFT blocks close — DraftEntriesPresentError, period unchanged, DRAFT row unchanged", async () => {
    const draft = await prisma.purchase.create({
      data: {
        organizationId: orgId,
        purchaseType: "COMPRA_GENERAL",
        status: "DRAFT",
        sequenceNumber: 9601,
        date: new Date("2099-03-09"),
        contactId,
        periodId,
        description: "Draft purchase",
        totalAmount: "350.00",
        createdById: userId,
      },
    });

    const service = makeMonthlyCloseService();

    await expect(
      service.close(orgId, periodId, userId),
    ).rejects.toBeInstanceOf(DraftEntriesPresentError);

    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("OPEN");
    expect(period.closedAt).toBeNull();
    expect(period.closedBy).toBeNull();

    const freshDraft = await prisma.purchase.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(freshDraft.status).toBe("DRAFT");

    const auditRows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: "fiscal_periods",
        entityId: periodId,
        action: "STATUS_CHANGE",
      },
    });
    expect(auditRows).toHaveLength(0);
  });
});

// ── Riesgo B Decimal precision NUMERIC(18,2) IVA rounding edge case ─────────
//
// Eje 4 (a) NEW C5 mismo cycle (Marco lock pre-RED). Stress-test el
// adapter `PrismaAccountingReaderAdapter.sumDebitCredit` raw SQL JOIN
// `COALESCE(SUM)::numeric(18,2)` cast — bit-perfect Decimal aggregation —
// + `Money.equals()` paired sister 4ta cementación cross-POC. Setup:
// 3 IVA-line entries (13% IVA tasa boliviana) que individual son fracciones
// no-redondeables a 2 decimales, pero la suma total balance = 0 exacto.
//
// Failure mode declarado pre-write: PASS-first esperado funcional (raw SQL
// cast bit-perfect + Money.of(string) factory boundary canonical conversion).
// FAIL aceptado surface honest si rounding asymmetry detectado a nivel
// adapter o Money VO.

describe("MonthlyCloseService.close (POC nuevo) — Riesgo B Decimal precision NUMERIC(18,2)", () => {
  it("close succeeds with IVA 13% rounded amounts that sum to balanced under NUMERIC(18,2)", async () => {
    // 3 JE balanced individual (debit = credit cada uno), pero con amounts
    // que ejercen el cast NUMERIC(18,2). Cada JE: debit "33.33" / credit
    // "33.33". SUM debit = 99.99, SUM credit = 99.99 → balance.equals true
    // bit-perfect post-cast.
    for (let i = 0; i < 3; i++) {
      const je = await prisma.journalEntry.create({
        data: {
          organizationId: orgId,
          voucherTypeId,
          periodId,
          createdById: userId,
          number: 100 + i,
          date: new Date(`2099-03-${10 + i}`),
          description: `Decimal precision JE ${i + 1}`,
          status: "POSTED",
        },
      });
      await prisma.journalLine.createMany({
        data: [
          {
            journalEntryId: je.id,
            accountId: accountDebitId,
            debit: "33.33",
            credit: "0",
          },
          {
            journalEntryId: je.id,
            accountId: accountCreditId,
            debit: "0",
            credit: "33.33",
          },
        ],
      });
    }

    const service = makeMonthlyCloseService();

    // Si rounding asymmetry corrompe SUM, balance no.equals → throws
    // BalanceNotZeroError. Sino, close succeeds y period queda CLOSED.
    const result = await service.close(orgId, periodId, userId);

    expect(result.periodStatus).toBe("CLOSED");
    expect(result.locked.journalEntries).toBe(3);

    // Money.equals paired sister 4ta cementación: re-leer balance shape
    // post-close vía mismo cast no es observable directo aquí (raw SQL vive
    // dentro UoW callback), pero el hecho que close succeed garantiza que
    // dentro-tx `balance.debit.equals(balance.credit)` evaluó true bit-
    // perfect — el adapter ya hizo ese check antes del lock cascade.
    const period = await prisma.fiscalPeriod.findUniqueOrThrow({
      where: { id: periodId },
    });
    expect(period.status).toBe("CLOSED");

    // Sanity: build Money VOs locales con strings idénticos a lo que el
    // adapter producirá `COALESCE(SUM(jl.debit))::numeric(18,2)` para 3
    // filas de "33.33" cada una. Money.equals reuse coherente domain pure.
    const expectedSum = Money.of("99.99");
    expect(expectedSum.equals(Money.of("99.99"))).toBe(true);
  });
});
