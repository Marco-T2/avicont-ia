import { beforeEach, describe, expect, it } from "vitest";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { computeIvaTotals } from "../../domain/compute-iva-totals";
import { IvaBookFiscalPeriodClosed } from "../../domain/errors/iva-book-errors";
import { IvaBookService } from "../iva-book.service";
import { InMemoryIvaSalesBookEntryRepository } from "./fakes/in-memory-iva-sales-book-entry.repository";
import { InMemoryIvaPurchaseBookEntryRepository } from "./fakes/in-memory-iva-purchase-book-entry.repository";
import { InMemoryIvaBookUnitOfWork } from "./fakes/in-memory-iva-book-unit-of-work";
import { InMemoryFiscalPeriodReader } from "./fakes/in-memory-fiscal-period-reader";
import { InMemorySaleReader } from "./fakes/in-memory-sale-reader";
import { InMemoryPurchaseReader } from "./fakes/in-memory-purchase-reader";
import { InMemorySaleJournalRegenNotifier } from "./fakes/in-memory-sale-journal-regen-notifier";
import { InMemoryPurchaseJournalRegenNotifier } from "./fakes/in-memory-purchase-journal-regen-notifier";

const m = (n: number): MonetaryAmount => MonetaryAmount.of(n);
const zero = MonetaryAmount.zero();

const ORG = "org-1";
const USER = "user-1";
const PERIOD = "period-1";

const baseSalesInputs = {
  importeTotal: m(1000),
  importeIce: zero,
  importeIehd: zero,
  importeIpj: zero,
  tasas: zero,
  otrosNoSujetos: zero,
  exentos: zero,
  tasaCero: zero,
  codigoDescuentoAdicional: zero,
  importeGiftCard: zero,
};

const baseSalesHeader = {
  organizationId: ORG,
  userId: USER,
  fiscalPeriodId: PERIOD,
  fechaFactura: new Date("2026-04-01"),
  nitCliente: "1234567890",
  razonSocial: "Cliente SA",
  numeroFactura: "FACT-001",
  codigoAutorizacion: "AUTH-XYZ",
  codigoControl: "CTRL-ABC",
  estadoSIN: "V" as const,
};

const basePurchaseInputs = {
  importeTotal: m(2000),
  importeIce: zero,
  importeIehd: zero,
  importeIpj: zero,
  tasas: zero,
  otrosNoSujetos: zero,
  exentos: zero,
  tasaCero: zero,
  codigoDescuentoAdicional: zero,
  importeGiftCard: zero,
};

const basePurchaseHeader = {
  organizationId: ORG,
  userId: USER,
  fiscalPeriodId: PERIOD,
  fechaFactura: new Date("2026-04-01"),
  nitProveedor: "9876543210",
  razonSocial: "Proveedor SRL",
  numeroFactura: "PROV-001",
  codigoAutorizacion: "AUTH-PROV",
  codigoControl: "CTRL-PROV",
  tipoCompra: 1,
};

interface Harness {
  service: IvaBookService;
  ivaSalesBooks: InMemoryIvaSalesBookEntryRepository;
  ivaPurchaseBooks: InMemoryIvaPurchaseBookEntryRepository;
  uow: InMemoryIvaBookUnitOfWork;
  fiscalPeriods: InMemoryFiscalPeriodReader;
  saleReader: InMemorySaleReader;
  purchaseReader: InMemoryPurchaseReader;
  saleJournalRegenNotifier: InMemorySaleJournalRegenNotifier;
  purchaseJournalRegenNotifier: InMemoryPurchaseJournalRegenNotifier;
}

function buildHarness(): Harness {
  const ivaSalesBooks = new InMemoryIvaSalesBookEntryRepository();
  const ivaPurchaseBooks = new InMemoryIvaPurchaseBookEntryRepository();
  const uow = new InMemoryIvaBookUnitOfWork({
    ivaSalesBooks,
    ivaPurchaseBooks,
  });
  const fiscalPeriods = new InMemoryFiscalPeriodReader();
  const saleReader = new InMemorySaleReader();
  const purchaseReader = new InMemoryPurchaseReader();
  const saleJournalRegenNotifier = new InMemorySaleJournalRegenNotifier();
  const purchaseJournalRegenNotifier =
    new InMemoryPurchaseJournalRegenNotifier();

  const service = new IvaBookService({
    uow,
    fiscalPeriods,
    saleReader,
    purchaseReader,
    saleJournalRegenNotifier,
    purchaseJournalRegenNotifier,
  });

  return {
    service,
    ivaSalesBooks,
    ivaPurchaseBooks,
    uow,
    fiscalPeriods,
    saleReader,
    purchaseReader,
    saleJournalRegenNotifier,
    purchaseJournalRegenNotifier,
  };
}

describe("IvaBookService.regenerateSale", () => {
  let h: Harness;
  beforeEach(() => {
    h = buildHarness();
    h.fiscalPeriods.preload(PERIOD, "OPEN");
  });

  it("happy POSTED+OPEN linked: persiste IvaBook + invoca SaleJournalRegenNotifier", async () => {
    h.saleReader.preload({
      id: "sale-1",
      organizationId: ORG,
      status: "POSTED",
    });

    const result = await h.service.regenerateSale({
      ...baseSalesHeader,
      saleId: "sale-1",
      inputs: baseSalesInputs,
    });

    expect(h.ivaSalesBooks.saveCalls).toHaveLength(1);
    expect(h.ivaSalesBooks.saveCalls[0].saleId).toBe("sale-1");
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(1);
    expect(h.saleJournalRegenNotifier.calls[0]).toEqual({
      organizationId: ORG,
      saleId: "sale-1",
      userId: USER,
    });
    expect(result.entry.saleId).toBe("sale-1");
    expect(result.correlationId).toMatch(/^corr-iva-test-/);
  });

  it("throws IvaBookFiscalPeriodClosed cuando sale POSTED + period CLOSED", async () => {
    h.fiscalPeriods.preload(PERIOD, "CLOSED");
    h.saleReader.preload({
      id: "sale-2",
      organizationId: ORG,
      status: "POSTED",
    });

    await expect(
      h.service.regenerateSale({
        ...baseSalesHeader,
        saleId: "sale-2",
        inputs: baseSalesInputs,
      }),
    ).rejects.toBeInstanceOf(IvaBookFiscalPeriodClosed);

    expect(h.ivaSalesBooks.saveCalls).toHaveLength(0);
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(0);
  });

  it("linked DRAFT persiste sin invocar bridge", async () => {
    h.saleReader.preload({
      id: "sale-3",
      organizationId: ORG,
      status: "DRAFT",
    });

    await h.service.regenerateSale({
      ...baseSalesHeader,
      saleId: "sale-3",
      inputs: baseSalesInputs,
    });

    expect(h.ivaSalesBooks.saveCalls).toHaveLength(1);
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(0);
  });

  it("standalone (no saleId) persiste sin invocar bridge", async () => {
    const result = await h.service.regenerateSale({
      ...baseSalesHeader,
      inputs: baseSalesInputs,
    });

    expect(h.ivaSalesBooks.saveCalls).toHaveLength(1);
    expect(h.ivaSalesBooks.saveCalls[0].saleId).toBeNull();
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(0);
    expect(h.saleReader.calls).toHaveLength(0);
    expect(result.entry.saleId).toBeNull();
  });

  it("estadoSIN intacto post-regenerate", async () => {
    await h.service.regenerateSale({
      ...baseSalesHeader,
      estadoSIN: "L",
      inputs: baseSalesInputs,
    });

    expect(h.ivaSalesBooks.saveCalls[0].estadoSIN).toBe("L");
  });

  it("server-side defense-in-depth: calcResult derived from computeIvaTotals(inputs)", async () => {
    const customInputs = {
      ...baseSalesInputs,
      importeTotal: m(1000),
      importeIce: m(50),
      codigoDescuentoAdicional: m(20),
    };
    const expectedCalc = computeIvaTotals(customInputs);

    await h.service.regenerateSale({
      ...baseSalesHeader,
      inputs: customInputs,
    });

    const persisted = h.ivaSalesBooks.saveCalls[0];
    expect(persisted.calcResult.subtotal.equals(expectedCalc.subtotal)).toBe(true);
    expect(
      persisted.calcResult.baseImponible.equals(expectedCalc.baseImponible),
    ).toBe(true);
    expect(persisted.calcResult.ivaAmount.equals(expectedCalc.ivaAmount)).toBe(true);
  });
});

describe("IvaBookService.regeneratePurchase", () => {
  let h: Harness;
  beforeEach(() => {
    h = buildHarness();
    h.fiscalPeriods.preload(PERIOD, "OPEN");
  });

  it("happy POSTED+OPEN linked: persiste IvaBook + invoca PurchaseJournalRegenNotifier", async () => {
    h.purchaseReader.preload({
      id: "purchase-1",
      organizationId: ORG,
      status: "POSTED",
    });

    const result = await h.service.regeneratePurchase({
      ...basePurchaseHeader,
      purchaseId: "purchase-1",
      inputs: basePurchaseInputs,
    });

    expect(h.ivaPurchaseBooks.saveCalls).toHaveLength(1);
    expect(h.ivaPurchaseBooks.saveCalls[0].purchaseId).toBe("purchase-1");
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(1);
    expect(h.purchaseJournalRegenNotifier.calls[0]).toEqual({
      organizationId: ORG,
      purchaseId: "purchase-1",
      userId: USER,
    });
    expect(result.entry.purchaseId).toBe("purchase-1");
    expect(result.correlationId).toMatch(/^corr-iva-test-/);
  });

  it("throws IvaBookFiscalPeriodClosed cuando purchase POSTED + period CLOSED", async () => {
    h.fiscalPeriods.preload(PERIOD, "CLOSED");
    h.purchaseReader.preload({
      id: "purchase-2",
      organizationId: ORG,
      status: "POSTED",
    });

    await expect(
      h.service.regeneratePurchase({
        ...basePurchaseHeader,
        purchaseId: "purchase-2",
        inputs: basePurchaseInputs,
      }),
    ).rejects.toBeInstanceOf(IvaBookFiscalPeriodClosed);

    expect(h.ivaPurchaseBooks.saveCalls).toHaveLength(0);
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(0);
  });

  it("linked DRAFT persiste sin invocar bridge", async () => {
    h.purchaseReader.preload({
      id: "purchase-3",
      organizationId: ORG,
      status: "DRAFT",
    });

    await h.service.regeneratePurchase({
      ...basePurchaseHeader,
      purchaseId: "purchase-3",
      inputs: basePurchaseInputs,
    });

    expect(h.ivaPurchaseBooks.saveCalls).toHaveLength(1);
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(0);
  });

  it("standalone (no purchaseId) persiste sin invocar bridge", async () => {
    const result = await h.service.regeneratePurchase({
      ...basePurchaseHeader,
      inputs: basePurchaseInputs,
    });

    expect(h.ivaPurchaseBooks.saveCalls).toHaveLength(1);
    expect(h.ivaPurchaseBooks.saveCalls[0].purchaseId).toBeNull();
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(0);
    expect(h.purchaseReader.calls).toHaveLength(0);
    expect(result.entry.purchaseId).toBeNull();
  });

  it("tipoCompra intacto post-regenerate", async () => {
    await h.service.regeneratePurchase({
      ...basePurchaseHeader,
      tipoCompra: 4,
      inputs: basePurchaseInputs,
    });

    expect(h.ivaPurchaseBooks.saveCalls[0].tipoCompra).toBe(4);
  });

  it("server-side defense-in-depth: calcResult derived from computeIvaTotals(inputs)", async () => {
    const customInputs = {
      ...basePurchaseInputs,
      importeTotal: m(2000),
      importeIce: m(100),
      codigoDescuentoAdicional: m(50),
    };
    const expectedCalc = computeIvaTotals(customInputs);

    await h.service.regeneratePurchase({
      ...basePurchaseHeader,
      inputs: customInputs,
    });

    const persisted = h.ivaPurchaseBooks.saveCalls[0];
    expect(persisted.calcResult.subtotal.equals(expectedCalc.subtotal)).toBe(true);
    expect(
      persisted.calcResult.baseImponible.equals(expectedCalc.baseImponible),
    ).toBe(true);
    expect(persisted.calcResult.ivaAmount.equals(expectedCalc.ivaAmount)).toBe(true);
  });
});
