/**
 * C4 — IvaBooksService → regenerateJournalForIvaChange correlationId propagation.
 *
 * REQ-CORR.4 Scenario B (canonical proof): when IvaBooksService.updatePurchase
 * is invoked on a POSTED + OPEN purchase, the propagation chain
 *
 *     IvaBooksService.updatePurchase
 *        → withAuditTx (correlationId generated, setAuditContext installed)
 *        → maybeRegenerateJournal
 *        → PurchaseService.regenerateJournalForIvaChange
 *
 * MUST emit audit_logs rows under a single correlationId across all entity
 * types touched by the cascade (iva_purchase_books, journal_entries,
 * journal_lines). This is the proof that withAuditTx + the discriminated-union
 * shape successfully thread one correlationId through the entire cascade.
 *
 * Pre-fix expected failure mode (RED):
 *   - On master (Phase 1), there is no correlationId emission anywhere — every
 *     audit_logs row would have correlationId = NULL. The assertion
 *     `row.correlationId === resultCid` fails on the very first row.
 *
 * GREEN: every audit row from the cascade has the same correlationId AND
 *        changedById = userId.
 *
 * @vitest-environment node
 */

// @vitest-environment node

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { IvaBooksRepository } from "@/features/accounting/iva-books/iva-books.repository";
import { PurchaseService } from "@/features/purchase/purchase.service";
import { setAuditContext } from "@/features/shared/audit-context";

let orgId: string;
let userId: string;
let periodId: string;
let contactId: string;
let purchaseId: string;
let ivaBookId: string;
let journalEntryId: string;

beforeAll(async () => {
  const stamp = Date.now();

  const user = await prisma.user.create({
    data: {
      clerkUserId: `iva-prop-${stamp}`,
      email: `iva-prop-${stamp}@test.com`,
      name: "Iva Propagation Integration",
    },
  });
  userId = user.id;

  const org = await prisma.organization.create({
    data: {
      clerkOrgId: `clerk-iva-prop-${stamp}`,
      slug: `iva-prop-${stamp}`,
      name: "Iva Propagation Org",
    },
  });
  orgId = org.id;

  const period = await prisma.fiscalPeriod.create({
    data: {
      organizationId: orgId,
      name: `Iva prop period ${stamp}`,
      year: 2026,
      month: 4,
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-30"),
      status: "OPEN",
      createdById: userId,
    },
  });
  periodId = period.id;

  await prisma.orgSettings.create({
    data: {
      organizationId: orgId,
      cxpAccountCode: "2.1.1.1",
    },
  });

  await prisma.account.createMany({
    data: [
      {
        organizationId: orgId,
        code: "2.1.1.1",
        name: "Cuentas por Pagar",
        type: "PASIVO",
        nature: "ACREEDORA",
        level: 4,
        isDetail: true,
      },
      {
        organizationId: orgId,
        code: "5.1.1",
        name: "Gastos generales",
        type: "GASTO",
        nature: "DEUDORA",
        level: 3,
        isDetail: true,
      },
      {
        organizationId: orgId,
        code: "1.1.8",
        name: "IVA Crédito Fiscal",
        type: "ACTIVO",
        nature: "DEUDORA",
        level: 3,
        isDetail: true,
      },
    ],
  });

  const contact = await prisma.contact.create({
    data: {
      organizationId: orgId,
      type: "PROVEEDOR",
      name: "Proveedor Iva Prop",
      paymentTermsDays: 30,
    },
  });
  contactId = contact.id;

  // Create a POSTED purchase + journal entry + ACTIVE IvaPurchaseBook directly
  // via prisma so we control sequence numbers and skip the full create+post path.
  const expenseAccount = await prisma.account.findFirstOrThrow({
    where: { organizationId: orgId, code: "5.1.1" },
  });
  const cxpAccount = await prisma.account.findFirstOrThrow({
    where: { organizationId: orgId, code: "2.1.1.1" },
  });

  const purchase = await prisma.purchase.create({
    data: {
      organizationId: orgId,
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 9001,
      date: new Date("2026-04-15T12:00:00Z"),
      contactId,
      periodId,
      description: "Iva prop test purchase",
      totalAmount: "1000.00",
      createdById: userId,
      details: {
        create: [
          {
            description: "expense line",
            lineAmount: "1000.00",
            quantity: "1",
            unitPrice: "1000",
            order: 0,
            expenseAccountId: expenseAccount.id,
          },
        ],
      },
    },
  });
  purchaseId = purchase.id;

  // Voucher type for the original journal entry
  const ce = await prisma.voucherTypeCfg.create({
    data: {
      organizationId: orgId,
      code: "CE",
      prefix: "CE",
      name: "Comprobante Egreso",
    },
  });

  const journalEntry = await prisma.journalEntry.create({
    data: {
      organizationId: orgId,
      voucherTypeId: ce.id,
      number: 9001,
      date: new Date("2026-04-15T12:00:00Z"),
      periodId,
      description: "CE Iva prop test",
      sourceType: "purchase",
      sourceId: purchaseId,
      createdById: userId,
      contactId,
      status: "POSTED",
      lines: {
        create: [
          { accountId: expenseAccount.id, debit: "1000.00", credit: "0.00", order: 0 },
          { accountId: cxpAccount.id, debit: "0.00", credit: "1000.00", order: 1, contactId },
        ],
      },
    },
  });
  journalEntryId = journalEntry.id;

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { journalEntryId },
  });

  // Create the ACTIVE IvaPurchaseBook linked to this purchase
  const ivaBook = await prisma.ivaPurchaseBook.create({
    data: {
      organizationId: orgId,
      fiscalPeriodId: periodId,
      purchaseId,
      fechaFactura: new Date("2026-04-15T12:00:00Z"),
      nitProveedor: "1234567",
      razonSocial: "Proveedor Iva Prop",
      numeroFactura: "FAC-PROP-001",
      codigoAutorizacion: "AUTH-001",
      codigoControl: "",
      tipoCompra: 1,
      importeTotal: "1000.00",
      importeIce: "0",
      importeIehd: "0",
      importeIpj: "0",
      tasas: "0",
      otrosNoSujetos: "0",
      exentos: "0",
      tasaCero: "0",
      codigoDescuentoAdicional: "0",
      importeGiftCard: "0",
      subtotal: "1000.00",
      dfIva: "130.00",
      baseIvaSujetoCf: "1000.00",
      dfCfIva: "130.00",
      tasaIva: "0.1300",
      status: "ACTIVE",
    },
  });
  ivaBookId = ivaBook.id;
});

afterAll(async () => {
  await prisma.$transaction(async (tx) => {
    await setAuditContext(tx, userId, orgId);
    await tx.accountBalance.deleteMany({ where: { organizationId: orgId } });
    await tx.journalLine.deleteMany({
      where: { journalEntry: { organizationId: orgId } },
    });
    await tx.journalEntry.deleteMany({ where: { organizationId: orgId } });
    await tx.ivaPurchaseBook.deleteMany({ where: { organizationId: orgId } });
    await tx.accountsPayable.deleteMany({ where: { organizationId: orgId } });
    await tx.purchaseDetail.deleteMany({
      where: { purchase: { organizationId: orgId } },
    });
    await tx.purchase.deleteMany({ where: { organizationId: orgId } });
    await tx.account.deleteMany({ where: { organizationId: orgId } });
    await tx.voucherTypeCfg.deleteMany({ where: { organizationId: orgId } });
    await tx.contact.deleteMany({ where: { organizationId: orgId } });
    await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
    await tx.orgSettings.deleteMany({ where: { organizationId: orgId } });
    await tx.fiscalPeriod.deleteMany({ where: { organizationId: orgId } });
  });
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("IvaBooksService → regenerateJournalForIvaChange — correlationId propagation (REQ-CORR.4 Scenario B)", () => {
  it("updatePurchase shares one correlationId across iva_purchase_books + journal_entries + journal_lines audit rows", async () => {
    // Clear any prior audit rows so the assertion captures only what
    // updatePurchase emits.
    await prisma.$transaction(async (tx) => {
      await setAuditContext(tx, userId, orgId);
      await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
    });

    const service = new IvaBooksService(
      new IvaBooksRepository(),
      undefined,
      new PurchaseService(),
    );

    const result = await service.updatePurchase(orgId, userId, ivaBookId, {
      importeTotal: new Prisma.Decimal("1500.00"), // bump to trigger regen
    });

    expect(result.correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const cid = result.correlationId;

    // NOTE: iva_purchase_books does NOT have an audit trigger — the audited
    // tables in this cascade are journal_entries + journal_lines (regen body
    // reverts + re-applies them). The proof of REQ-CORR.4 Scenario B is that
    // ALL audited rows touched by the cascade share ONE correlationId.
    const rows = await prisma.auditLog.findMany({
      where: {
        organizationId: orgId,
        entityType: { in: ["journal_entries", "journal_lines", "purchases"] },
      },
    });

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(
        row.correlationId,
        `correlationId mismatch on ${row.entityType}:${row.entityId} (got ${row.correlationId}, want ${cid})`,
      ).toBe(cid);
      expect(
        row.changedById,
        `changedById null on ${row.entityType}:${row.entityId}`,
      ).toBe(userId);
    }

    // Sanity: the cascade must have touched journal_entries + journal_lines.
    const byType = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.entityType] = (acc[r.entityType] ?? 0) + 1;
      return acc;
    }, {});
    expect(Object.keys(byType)).toContain("journal_entries");
    expect(Object.keys(byType)).toContain("journal_lines");
  });
});
