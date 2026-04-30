import { beforeEach, describe, expect, it } from "vitest";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { computeIvaTotals } from "../../domain/compute-iva-totals";
import { IvaBookFiscalPeriodClosed } from "../../domain/errors/iva-book-errors";
import { IvaSalesBookEntry } from "../../domain/iva-sales-book-entry.entity";
import { IvaPurchaseBookEntry } from "../../domain/iva-purchase-book-entry.entity";
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

function seedSalesEntry(
  h: Harness,
  opts: {
    saleId?: string;
    status?: "ACTIVE" | "VOIDED";
    inputs?: Partial<typeof baseSalesInputs>;
    estadoSIN?: "A" | "V" | "C" | "L";
  } = {},
): IvaSalesBookEntry {
  const inputs = { ...baseSalesInputs, ...opts.inputs };
  const calcResult = computeIvaTotals(inputs);
  let entry = IvaSalesBookEntry.create({
    organizationId: ORG,
    fiscalPeriodId: PERIOD,
    saleId: opts.saleId,
    fechaFactura: baseSalesHeader.fechaFactura,
    nitCliente: baseSalesHeader.nitCliente,
    razonSocial: baseSalesHeader.razonSocial,
    numeroFactura: baseSalesHeader.numeroFactura,
    codigoAutorizacion: baseSalesHeader.codigoAutorizacion,
    codigoControl: baseSalesHeader.codigoControl,
    estadoSIN: opts.estadoSIN ?? baseSalesHeader.estadoSIN,
    notes: null,
    inputs: {
      importeTotal: inputs.importeTotal,
      importeIce: inputs.importeIce,
      importeIehd: inputs.importeIehd,
      importeIpj: inputs.importeIpj,
      tasas: inputs.tasas,
      otrosNoSujetos: inputs.otrosNoSujetos,
      exentos: inputs.exentos,
      tasaCero: inputs.tasaCero,
      codigoDescuentoAdicional: inputs.codigoDescuentoAdicional,
      importeGiftCard: inputs.importeGiftCard,
    },
    calcResult,
  });
  if (opts.status === "VOIDED") entry = entry.void();
  h.ivaSalesBooks.preload(entry);
  return entry;
}

function seedPurchaseEntry(
  h: Harness,
  opts: {
    purchaseId?: string;
    status?: "ACTIVE" | "VOIDED";
    inputs?: Partial<typeof basePurchaseInputs>;
    tipoCompra?: number;
  } = {},
): IvaPurchaseBookEntry {
  const inputs = { ...basePurchaseInputs, ...opts.inputs };
  const calcResult = computeIvaTotals(inputs);
  let entry = IvaPurchaseBookEntry.create({
    organizationId: ORG,
    fiscalPeriodId: PERIOD,
    purchaseId: opts.purchaseId,
    fechaFactura: basePurchaseHeader.fechaFactura,
    nitProveedor: basePurchaseHeader.nitProveedor,
    razonSocial: basePurchaseHeader.razonSocial,
    numeroFactura: basePurchaseHeader.numeroFactura,
    codigoAutorizacion: basePurchaseHeader.codigoAutorizacion,
    codigoControl: basePurchaseHeader.codigoControl,
    tipoCompra: opts.tipoCompra ?? basePurchaseHeader.tipoCompra,
    notes: null,
    inputs: {
      importeTotal: inputs.importeTotal,
      importeIce: inputs.importeIce,
      importeIehd: inputs.importeIehd,
      importeIpj: inputs.importeIpj,
      tasas: inputs.tasas,
      otrosNoSujetos: inputs.otrosNoSujetos,
      exentos: inputs.exentos,
      tasaCero: inputs.tasaCero,
      codigoDescuentoAdicional: inputs.codigoDescuentoAdicional,
      importeGiftCard: inputs.importeGiftCard,
    },
    calcResult,
  });
  if (opts.status === "VOIDED") entry = entry.void();
  h.ivaPurchaseBooks.preload(entry);
  return entry;
}

describe("IvaBookService.recomputeSale", () => {
  let h: Harness;
  beforeEach(() => {
    h = buildHarness();
    h.fiscalPeriods.preload(PERIOD, "OPEN");
  });

  it("happy POSTED+OPEN+monetary change: merge current + recompute + update + bridge", async () => {
    const entry = seedSalesEntry(h, { saleId: "sale-r1" });
    h.saleReader.preload({ id: "sale-r1", organizationId: ORG, status: "POSTED" });

    const result = await h.service.recomputeSale({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { importeTotal: m(2000) },
    });

    expect(h.ivaSalesBooks.updateCalls).toHaveLength(1);
    expect(h.ivaSalesBooks.saveCalls).toHaveLength(0);
    const persisted = h.ivaSalesBooks.updateCalls[0];
    expect(persisted.inputs.importeTotal.equals(m(2000))).toBe(true);
    // merge: importeIce mantiene del current (zero)
    expect(persisted.inputs.importeIce.equals(zero)).toBe(true);
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(1);
    expect(h.saleJournalRegenNotifier.calls[0]).toEqual({
      organizationId: ORG,
      saleId: "sale-r1",
      userId: USER,
    });
    expect(result.entry.id).toBe(entry.id);
  });

  it("throws IvaBookFiscalPeriodClosed (operation=modify) cuando POSTED + period CLOSED", async () => {
    h.fiscalPeriods.preload(PERIOD, "CLOSED");
    const entry = seedSalesEntry(h, { saleId: "sale-r2" });
    h.saleReader.preload({ id: "sale-r2", organizationId: ORG, status: "POSTED" });

    await expect(
      h.service.recomputeSale({
        organizationId: ORG,
        userId: USER,
        id: entry.id,
        inputs: { importeTotal: m(2000) },
      }),
    ).rejects.toBeInstanceOf(IvaBookFiscalPeriodClosed);

    expect(h.ivaSalesBooks.updateCalls).toHaveLength(0);
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(0);
  });

  it("POSTED+OPEN sin monetary change: NO recompute, update header partial, bridge se invoca igual (legacy parity)", async () => {
    const entry = seedSalesEntry(h, { saleId: "sale-r3" });
    h.saleReader.preload({ id: "sale-r3", organizationId: ORG, status: "POSTED" });

    const originalCalcResult = entry.calcResult;

    await h.service.recomputeSale({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      numeroFactura: "FACT-PATCH",
    });

    expect(h.ivaSalesBooks.updateCalls).toHaveLength(1);
    const persisted = h.ivaSalesBooks.updateCalls[0];
    expect(persisted.numeroFactura).toBe("FACT-PATCH");
    // calcResult preserved (NO recompute path L locked)
    expect(persisted.calcResult.equals(originalCalcResult)).toBe(true);
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(1);
  });

  it("DRAFT+monetary change: persiste sin bridge", async () => {
    const entry = seedSalesEntry(h, { saleId: "sale-r4" });
    h.saleReader.preload({ id: "sale-r4", organizationId: ORG, status: "DRAFT" });

    await h.service.recomputeSale({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { importeTotal: m(3000) },
    });

    expect(h.ivaSalesBooks.updateCalls).toHaveLength(1);
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(0);
  });

  it("standalone (entry sin saleId): persiste sin bridge ni period gate", async () => {
    const entry = seedSalesEntry(h);

    await h.service.recomputeSale({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { importeTotal: m(4000) },
    });

    expect(h.ivaSalesBooks.updateCalls).toHaveLength(1);
    expect(h.saleJournalRegenNotifier.calls).toHaveLength(0);
    expect(h.saleReader.calls).toHaveLength(0);
  });

  it("D-A1#7 fidelidad legacy regla #1: recompute acepta input sobre IvaBook VOIDED", async () => {
    const entry = seedSalesEntry(h, {
      saleId: "sale-r6",
      status: "VOIDED",
    });
    h.saleReader.preload({ id: "sale-r6", organizationId: ORG, status: "POSTED" });

    await h.service.recomputeSale({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { importeTotal: m(2500) },
    });

    expect(h.ivaSalesBooks.updateCalls).toHaveLength(1);
    const persisted = h.ivaSalesBooks.updateCalls[0];
    expect(persisted.status).toBe("VOIDED");
    expect(persisted.inputs.importeTotal.equals(m(2500))).toBe(true);
  });

  it("defense-in-depth: calcResult derived from computeIvaTotals(merged inputs)", async () => {
    const entry = seedSalesEntry(h, {
      saleId: "sale-r7",
      inputs: { importeTotal: m(1000), importeIce: m(50) },
    });
    h.saleReader.preload({ id: "sale-r7", organizationId: ORG, status: "DRAFT" });

    await h.service.recomputeSale({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { codigoDescuentoAdicional: m(20) },
    });

    const merged = {
      importeTotal: m(1000),
      importeIce: m(50),
      importeIehd: zero,
      importeIpj: zero,
      tasas: zero,
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
      codigoDescuentoAdicional: m(20),
      importeGiftCard: zero,
    };
    const expected = computeIvaTotals(merged);
    const persisted = h.ivaSalesBooks.updateCalls[0];
    expect(persisted.calcResult.subtotal.equals(expected.subtotal)).toBe(true);
    expect(persisted.calcResult.baseImponible.equals(expected.baseImponible)).toBe(true);
    expect(persisted.calcResult.ivaAmount.equals(expected.ivaAmount)).toBe(true);
  });
});

describe("IvaBookService.recomputePurchase", () => {
  let h: Harness;
  beforeEach(() => {
    h = buildHarness();
    h.fiscalPeriods.preload(PERIOD, "OPEN");
  });

  it("happy POSTED+OPEN+monetary change: merge current + recompute + update + bridge", async () => {
    const entry = seedPurchaseEntry(h, { purchaseId: "purchase-r1" });
    h.purchaseReader.preload({ id: "purchase-r1", organizationId: ORG, status: "POSTED" });

    const result = await h.service.recomputePurchase({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { importeTotal: m(3000) },
    });

    expect(h.ivaPurchaseBooks.updateCalls).toHaveLength(1);
    expect(h.ivaPurchaseBooks.saveCalls).toHaveLength(0);
    const persisted = h.ivaPurchaseBooks.updateCalls[0];
    expect(persisted.inputs.importeTotal.equals(m(3000))).toBe(true);
    expect(persisted.inputs.importeIce.equals(zero)).toBe(true);
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(1);
    expect(h.purchaseJournalRegenNotifier.calls[0]).toEqual({
      organizationId: ORG,
      purchaseId: "purchase-r1",
      userId: USER,
    });
    expect(result.entry.id).toBe(entry.id);
  });

  it("throws IvaBookFiscalPeriodClosed (operation=modify) cuando POSTED + period CLOSED", async () => {
    h.fiscalPeriods.preload(PERIOD, "CLOSED");
    const entry = seedPurchaseEntry(h, { purchaseId: "purchase-r2" });
    h.purchaseReader.preload({ id: "purchase-r2", organizationId: ORG, status: "POSTED" });

    await expect(
      h.service.recomputePurchase({
        organizationId: ORG,
        userId: USER,
        id: entry.id,
        inputs: { importeTotal: m(3000) },
      }),
    ).rejects.toBeInstanceOf(IvaBookFiscalPeriodClosed);

    expect(h.ivaPurchaseBooks.updateCalls).toHaveLength(0);
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(0);
  });

  it("POSTED+OPEN sin monetary change: NO recompute, update header partial, bridge se invoca igual", async () => {
    const entry = seedPurchaseEntry(h, { purchaseId: "purchase-r3" });
    h.purchaseReader.preload({ id: "purchase-r3", organizationId: ORG, status: "POSTED" });

    const originalCalcResult = entry.calcResult;

    await h.service.recomputePurchase({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      numeroFactura: "PROV-PATCH",
    });

    expect(h.ivaPurchaseBooks.updateCalls).toHaveLength(1);
    const persisted = h.ivaPurchaseBooks.updateCalls[0];
    expect(persisted.numeroFactura).toBe("PROV-PATCH");
    expect(persisted.calcResult.equals(originalCalcResult)).toBe(true);
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(1);
  });

  it("DRAFT+monetary change: persiste sin bridge", async () => {
    const entry = seedPurchaseEntry(h, { purchaseId: "purchase-r4" });
    h.purchaseReader.preload({ id: "purchase-r4", organizationId: ORG, status: "DRAFT" });

    await h.service.recomputePurchase({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { importeTotal: m(3500) },
    });

    expect(h.ivaPurchaseBooks.updateCalls).toHaveLength(1);
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(0);
  });

  it("standalone (entry sin purchaseId): persiste sin bridge ni period gate", async () => {
    const entry = seedPurchaseEntry(h);

    await h.service.recomputePurchase({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { importeTotal: m(4000) },
    });

    expect(h.ivaPurchaseBooks.updateCalls).toHaveLength(1);
    expect(h.purchaseJournalRegenNotifier.calls).toHaveLength(0);
    expect(h.purchaseReader.calls).toHaveLength(0);
  });

  it("D-A1#7 fidelidad legacy regla #1: recompute acepta input sobre IvaBook VOIDED", async () => {
    const entry = seedPurchaseEntry(h, {
      purchaseId: "purchase-r6",
      status: "VOIDED",
    });
    h.purchaseReader.preload({ id: "purchase-r6", organizationId: ORG, status: "POSTED" });

    await h.service.recomputePurchase({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { importeTotal: m(2500) },
    });

    expect(h.ivaPurchaseBooks.updateCalls).toHaveLength(1);
    const persisted = h.ivaPurchaseBooks.updateCalls[0];
    expect(persisted.status).toBe("VOIDED");
    expect(persisted.inputs.importeTotal.equals(m(2500))).toBe(true);
  });

  it("defense-in-depth: calcResult derived from computeIvaTotals(merged inputs)", async () => {
    const entry = seedPurchaseEntry(h, {
      purchaseId: "purchase-r7",
      inputs: { importeTotal: m(2000), importeIce: m(80) },
    });
    h.purchaseReader.preload({ id: "purchase-r7", organizationId: ORG, status: "DRAFT" });

    await h.service.recomputePurchase({
      organizationId: ORG,
      userId: USER,
      id: entry.id,
      inputs: { codigoDescuentoAdicional: m(40) },
    });

    const merged = {
      importeTotal: m(2000),
      importeIce: m(80),
      importeIehd: zero,
      importeIpj: zero,
      tasas: zero,
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
      codigoDescuentoAdicional: m(40),
      importeGiftCard: zero,
    };
    const expected = computeIvaTotals(merged);
    const persisted = h.ivaPurchaseBooks.updateCalls[0];
    expect(persisted.calcResult.subtotal.equals(expected.subtotal)).toBe(true);
    expect(persisted.calcResult.baseImponible.equals(expected.baseImponible)).toBe(true);
    expect(persisted.calcResult.ivaAmount.equals(expected.ivaAmount)).toBe(true);
  });
});
