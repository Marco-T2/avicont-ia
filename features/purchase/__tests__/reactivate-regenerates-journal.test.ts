/**
 * T8.3 RED → T8.4 GREEN: reactivatePurchase triggers journal regen WITH IVA lines.
 *
 * REQ-A.4, B.1: After IvaBooksService.reactivatePurchase(orgId, userId, ivaBookId),
 * the regenerateJournalForIvaChange is called once AND
 * buildPurchaseEntryLines WITH ivaBook produces IVA lines.
 *
 * Mirror of the reactivateSale coverage in iva-books.service.cascade.test.ts,
 * adapted for the purchase side.
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

const ORG_ID = "org-reactivate-journal-test";
const USER_ID = "user-reactivate-journal-test";
const PURCHASE_ID = "purchase-reactivate-journal-test";
const PERIOD_ID = "period-reactivate-journal-test";
const ENTRY_ID = "iva-purchase-book-reactivate-journal-test";

const settings: PurchaseOrgSettings = {
  cxpAccountCode: "2.1.1",
  fleteExpenseAccountCode: "5.2.1",
  polloFaenadoCOGSAccountCode: "5.1.1",
};

const details: PurchaseDetailForEntry[] = [
  { lineAmount: 100, description: "Servicio reactivado", expenseAccountCode: "5.1.1" },
];

const ivaBook = {
  baseIvaSujetoCf: 100,
  dfCfIva: 13,
  importeTotal: 100,
  exentos: 0,
};

// ── Part 1: buildPurchaseEntryLines WITH ivaBook → IVA line present ───────────
// This is the state AFTER reactivate: ivaBook is ACTIVE, journal rebuild
// receives the ivaBook parameter → IVA path.

describe("Regression T8.3 — reactivate: buildPurchaseEntryLines with ivaBook produces IVA line", () => {
  it("T8.3-a — IVA debit line (IVA_CREDITO_FISCAL = 1.1.8) is present when ivaBook is provided", () => {
    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      100,
      details,
      settings,
      "contact-01",
      ivaBook,
    );
    const ivaLine = lines.find((l) => l.accountCode === IVA_CREDITO_FISCAL);
    expect(ivaLine).toBeDefined();
  });

  it("T8.3-b — reactivate is the inverse of unlink: without ivaBook=2 lines, with ivaBook>2 lines", () => {
    // Unlink / VOIDED path
    const linesWithout = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      100,
      details,
      settings,
      "contact-01",
    );
    expect(linesWithout).toHaveLength(2);

    // Reactivate / ACTIVE path — includes IVA line so at least 3 lines
    const linesWith = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      100,
      details,
      settings,
      "contact-01",
      ivaBook,
    );
    expect(linesWith.length).toBeGreaterThan(2);
    expect(linesWith.find((l) => l.accountCode === IVA_CREDITO_FISCAL)).toBeDefined();
  });

  it("T8.3-c — no IVA line present without ivaBook (void state — regression guard)", () => {
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
});

// ── Part 2: IvaBooksService.reactivatePurchase calls regenerateJournalForIvaChange ──

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
    status: "ACTIVE",
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

describe("Regression T8.4 — reactivatePurchase service bridge triggers journal regeneration with IVA", () => {
  it("T8.4 — reactivatePurchase calls purchaseService.regenerateJournalForIvaChange once", async () => {
    const repo = {
      reactivatePurchase: vi.fn().mockResolvedValue(makePurchaseDTO({ status: "ACTIVE" })),
      // Audit F #4/#5: reactivatePurchase now wraps in repo.transaction.
      transaction: vi
        .fn()
        .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
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

    await service.reactivatePurchase(ORG_ID, USER_ID, ENTRY_ID);

    expect(purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledTimes(1);
    expect(purchaseService.regenerateJournalForIvaChange).toHaveBeenCalledWith(
      ORG_ID,
      PURCHASE_ID,
      USER_ID,
      expect.anything(),
    );
  });
});
