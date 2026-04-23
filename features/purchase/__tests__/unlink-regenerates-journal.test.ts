/**
 * T8.1 RED → T8.2 GREEN: unlink (voidPurchase) triggers journal regen without IVA/IT.
 *
 * REQ-A.3: After IvaBooksService.voidPurchase(orgId, userId, ivaBookId),
 * the regenerateJournalForIvaChange is called once AND
 * buildPurchaseEntryLines WITHOUT ivaBook produces NO IVA / NO IT lines.
 *
 * Mirrors features/accounting/iva-books/__tests__/iva-books.service.cascade.test.ts
 * Regression T2.5 block, but for the purchase side.
 */

import { describe, it, expect, vi } from "vitest";
import { buildPurchaseEntryLines, IVA_CREDITO_FISCAL } from "@/features/purchase/purchase.utils";
import type { PurchaseDetailForEntry, PurchaseOrgSettings } from "@/features/purchase/purchase.utils";
import { IvaBooksService, IvaBooksRepository } from "@/features/accounting/iva-books/server";
import { PurchaseService } from "@/features/purchase/purchase.service";
import type { IvaPurchaseBookDTO } from "@/features/accounting/iva-books";
import { Prisma } from "@/generated/prisma/client";

// ── Helpers ──────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ZERO = D("0");

const ORG_ID = "org-unlink-test";
const USER_ID = "user-unlink-test";
const PURCHASE_ID = "purchase-unlink-test";
const PERIOD_ID = "period-unlink-test";
const ENTRY_ID = "iva-purchase-book-unlink-test";

const settings: PurchaseOrgSettings = {
  cxpAccountCode: "2.1.1",
  fleteExpenseAccountCode: "5.2.1",
  polloFaenadoCOGSAccountCode: "5.1.1",
};

const details: PurchaseDetailForEntry[] = [
  { lineAmount: 100, description: "Servicio comprado", expenseAccountCode: "5.1.1" },
];

// ── Part 1: buildPurchaseEntryLines WITHOUT ivaBook → no IVA/IT lines ─────────
// This is the state AFTER unlink (void): ivaBook is VOIDED, so the journal
// rebuild receives no ivaBook parameter → non-IVA path.

describe("Regression T8.1 — unlink: buildPurchaseEntryLines without ivaBook produces no IVA/IT lines", () => {
  it("T8.1-a — no IVA debit line (1.1.8 = IVA_CREDITO_FISCAL) when ivaBook is absent", () => {
    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      100,
      details,
      settings,
      "contact-01",
    );
    const ivaLine = lines.find((l) => l.accountCode === IVA_CREDITO_FISCAL);
    expect(ivaLine).toBeUndefined();
  });

  it("T8.1-b — only expense + CxP lines present when ivaBook is absent (no extra lines)", () => {
    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      100,
      details,
      settings,
      "contact-01",
    );
    // Every line must be either the expense account or the CxP account
    for (const line of lines) {
      expect([details[0].expenseAccountCode, settings.cxpAccountCode]).toContain(line.accountCode);
    }
  });

  it("T8.1-d — exactly 2 lines: DR gasto + CR CxP (minimal non-IVA journal)", () => {
    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      100,
      details,
      settings,
      "contact-01",
    );
    expect(lines).toHaveLength(2);
  });
});

// ── Part 2: IvaBooksService.voidPurchase calls regenerateJournalForIvaChange ──

function makePurchaseDTO(overrides: Partial<IvaPurchaseBookDTO> = {}): IvaPurchaseBookDTO {
  return {
    id: ENTRY_ID,
    organizationId: ORG_ID,
    fiscalPeriodId: PERIOD_ID,
    purchaseId: PURCHASE_ID,
    fechaFactura: "2025-03-15",
    nitProveedor: "7654321",
    razonSocial: "Proveedor Test",
    numeroFactura: "FAC-COMP-001",
    codigoAutorizacion: "AUTH-COMP-001",
    codigoControl: "",
    tipoCompra: 1,
    status: "VOIDED",
    createdAt: new Date(),
    updatedAt: new Date(),
    importeTotal: D("100.00"),
    importeIce: ZERO,
    importeIehd: ZERO,
    importeIpj: ZERO,
    tasas: ZERO,
    otrosNoSujetos: ZERO,
    exentos: ZERO,
    tasaCero: ZERO,
    codigoDescuentoAdicional: ZERO,
    importeGiftCard: ZERO,
    subtotal: D("100.00"),
    dfIva: D("13.00"),
    baseIvaSujetoCf: D("100.00"),
    dfCfIva: D("13.00"),
    tasaIva: D("0.1300"),
    ...overrides,
  };
}

describe("Regression T8.2 — voidPurchase service bridge triggers journal regeneration", () => {
  it("T8.2 — voidPurchase calls purchaseService.regenerateJournalForIvaChange once", async () => {
    const repo = {
      voidPurchase: vi.fn().mockResolvedValue(makePurchaseDTO({ status: "VOIDED" })),
      findPurchaseById: vi.fn().mockResolvedValue(makePurchaseDTO()),
    } as unknown as IvaBooksRepository;

    const purchaseService = {
      getById: vi.fn().mockResolvedValue({
        id: PURCHASE_ID,
        status: "POSTED",
        periodId: PERIOD_ID,
        period: { id: PERIOD_ID, status: "OPEN" },
      }),
      regenerateJournalForIvaChange: vi.fn().mockResolvedValue({}),
    } as unknown as PurchaseService;

    const service = new IvaBooksService(repo, undefined, purchaseService);

    await service.voidPurchase(ORG_ID, USER_ID, ENTRY_ID);

    expect(purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledTimes(1);
    expect(purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
      ORG_ID,
      PURCHASE_ID,
      USER_ID,
    );
  });
});
