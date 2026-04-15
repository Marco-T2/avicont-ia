import { describe, it, expect } from "vitest";
import {
  createPurchaseInputSchema,
  createSaleInputSchema,
  updatePurchaseInputSchema,
  updateSaleInputSchema,
  listQuerySchema,
} from "@/features/accounting/iva-books/iva-books.validation";

// ── Fixtures base ─────────────────────────────────────────────────────────────

const validPurchase = {
  fechaFactura: "2025-01-15",
  nitProveedor: "1234567",
  razonSocial: "Empresa ABC S.R.L.",
  numeroFactura: "001-001-00001234",
  codigoAutorizacion: "1234567890123456",
  codigoControl: "AB-CD-EF",
  importeTotal: "1000.00",
  importeIce: "0.00",
  importeIehd: "0.00",
  importeIpj: "0.00",
  tasas: "0.00",
  otrosNoSujetos: "0.00",
  exentos: "0.00",
  tasaCero: "0.00",
  subtotal: "1000.00",
  dfIva: "115.04",
  codigoDescuentoAdicional: "0.00",
  importeGiftCard: "0.00",
  baseIvaSujetoCf: "1000.00",
  dfCfIva: "115.04",
  tasaIva: "0.1300",
  tipoCompra: 1,
  fiscalPeriodId: "clxxx123",
};

const validSale = {
  fechaFactura: "2025-01-15",
  nitCliente: "7654321",
  razonSocial: "Cliente XYZ",
  numeroFactura: "001-001-00005678",
  codigoAutorizacion: "6543210987654321",
  codigoControl: "GH-IJ-KL",
  importeTotal: "500.00",
  importeIce: "0.00",
  importeIehd: "0.00",
  importeIpj: "0.00",
  tasas: "0.00",
  otrosNoSujetos: "0.00",
  exentos: "0.00",
  tasaCero: "0.00",
  subtotal: "500.00",
  dfIva: "57.52",
  codigoDescuentoAdicional: "0.00",
  importeGiftCard: "0.00",
  baseIvaSujetoCf: "500.00",
  dfCfIva: "57.52",
  tasaIva: "0.1300",
  estadoSIN: "A",
  fiscalPeriodId: "clxxx123",
};

// ── createPurchaseInputSchema ─────────────────────────────────────────────────

describe("createPurchaseInputSchema — happy paths", () => {
  it("valida un input de compra completo y válido", () => {
    const result = createPurchaseInputSchema.safeParse(validPurchase);
    expect(result.success).toBe(true);
  });

  it("acepta purchaseId opcional cuando se provee", () => {
    const result = createPurchaseInputSchema.safeParse({
      ...validPurchase,
      purchaseId: "clxxx456",
    });
    expect(result.success).toBe(true);
  });

  it("acepta sin purchaseId (entrada standalone)", () => {
    const result = createPurchaseInputSchema.safeParse(validPurchase);
    expect(result.success).toBe(true);
  });

  it("compra 100% exenta — montoSujetoCF=0, IVA=0 — válida", () => {
    const result = createPurchaseInputSchema.safeParse({
      ...validPurchase,
      exentos: "1000.00",
      subtotal: "0.00",
      dfIva: "0.00",
      baseIvaSujetoCf: "0.00",
      dfCfIva: "0.00",
      tipoCompra: 4,
    });
    expect(result.success).toBe(true);
  });
});

describe("createPurchaseInputSchema — sad paths", () => {
  it("falla si falta fechaFactura", () => {
    const { fechaFactura: _, ...rest } = validPurchase;
    const result = createPurchaseInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("falla si falta nitProveedor", () => {
    const { nitProveedor: _, ...rest } = validPurchase;
    const result = createPurchaseInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("falla si falta numeroFactura", () => {
    const { numeroFactura: _, ...rest } = validPurchase;
    const result = createPurchaseInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("falla si importeTotal es negativo", () => {
    const result = createPurchaseInputSchema.safeParse({
      ...validPurchase,
      importeTotal: "-100.00",
    });
    expect(result.success).toBe(false);
  });

  it("falla si nitProveedor es string vacío", () => {
    const result = createPurchaseInputSchema.safeParse({
      ...validPurchase,
      nitProveedor: "",
    });
    expect(result.success).toBe(false);
  });

  it("falla si falta codigoAutorizacion", () => {
    const { codigoAutorizacion: _, ...rest } = validPurchase;
    const result = createPurchaseInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("falla si falta fiscalPeriodId", () => {
    const { fiscalPeriodId: _, ...rest } = validPurchase;
    const result = createPurchaseInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ── createSaleInputSchema ─────────────────────────────────────────────────────

describe("createSaleInputSchema — happy paths", () => {
  it("valida una venta completa con estadoSIN=A", () => {
    const result = createSaleInputSchema.safeParse(validSale);
    expect(result.success).toBe(true);
  });

  it("valida estadoSIN=V (anulado)", () => {
    const result = createSaleInputSchema.safeParse({
      ...validSale,
      estadoSIN: "V",
    });
    expect(result.success).toBe(true);
  });

  it("valida estadoSIN=C (contingencia)", () => {
    const result = createSaleInputSchema.safeParse({
      ...validSale,
      estadoSIN: "C",
    });
    expect(result.success).toBe(true);
  });

  it("valida estadoSIN=L (libre)", () => {
    const result = createSaleInputSchema.safeParse({
      ...validSale,
      estadoSIN: "L",
    });
    expect(result.success).toBe(true);
  });

  it("acepta saleId opcional cuando se provee", () => {
    const result = createSaleInputSchema.safeParse({
      ...validSale,
      saleId: "clyyy789",
    });
    expect(result.success).toBe(true);
  });
});

describe("createSaleInputSchema — sad paths", () => {
  it("falla si estadoSIN está fuera de A/V/C/L", () => {
    const result = createSaleInputSchema.safeParse({
      ...validSale,
      estadoSIN: "X",
    });
    expect(result.success).toBe(false);
  });

  it("falla si estadoSIN es string vacío", () => {
    const result = createSaleInputSchema.safeParse({
      ...validSale,
      estadoSIN: "",
    });
    expect(result.success).toBe(false);
  });

  it("falla si falta estadoSIN (campo obligatorio)", () => {
    const { estadoSIN: _, ...rest } = validSale;
    const result = createSaleInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("falla si falta nitCliente", () => {
    const { nitCliente: _, ...rest } = validSale;
    const result = createSaleInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("falla si importeTotal es negativo", () => {
    const result = createSaleInputSchema.safeParse({
      ...validSale,
      importeTotal: "-50.00",
    });
    expect(result.success).toBe(false);
  });

  it("falla si falta numeroFactura", () => {
    const { numeroFactura: _, ...rest } = validSale;
    const result = createSaleInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// ── updatePurchaseInputSchema ─────────────────────────────────────────────────

describe("updatePurchaseInputSchema", () => {
  it("permite actualización parcial — solo notas", () => {
    const result = updatePurchaseInputSchema.safeParse({ notes: "Corrección" });
    expect(result.success).toBe(true);
  });

  it("permite actualización con todos los campos", () => {
    const result = updatePurchaseInputSchema.safeParse({
      ...validPurchase,
      notes: "Corregido",
    });
    expect(result.success).toBe(true);
  });

  it("objeto vacío es válido (patch parcial)", () => {
    const result = updatePurchaseInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ── updateSaleInputSchema ─────────────────────────────────────────────────────

describe("updateSaleInputSchema", () => {
  it("permite actualización de estadoSIN solo", () => {
    const result = updateSaleInputSchema.safeParse({ estadoSIN: "C" });
    expect(result.success).toBe(true);
  });

  it("rechaza estadoSIN inválido en update", () => {
    const result = updateSaleInputSchema.safeParse({ estadoSIN: "Z" });
    expect(result.success).toBe(false);
  });

  it("objeto vacío es válido (patch parcial)", () => {
    const result = updateSaleInputSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

// ── listQuerySchema ───────────────────────────────────────────────────────────

describe("listQuerySchema", () => {
  it("acepta fiscalPeriodId como filtro principal", () => {
    const result = listQuerySchema.safeParse({ fiscalPeriodId: "clxxx123" });
    expect(result.success).toBe(true);
  });

  it("acepta sin parámetros — devuelve todos", () => {
    const result = listQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("acepta status=ACTIVE", () => {
    const result = listQuerySchema.safeParse({
      fiscalPeriodId: "clxxx123",
      status: "ACTIVE",
    });
    expect(result.success).toBe(true);
  });

  it("acepta status=VOIDED", () => {
    const result = listQuerySchema.safeParse({ status: "VOIDED" });
    expect(result.success).toBe(true);
  });

  it("rechaza status fuera de ACTIVE/VOIDED", () => {
    const result = listQuerySchema.safeParse({ status: "DELETED" });
    expect(result.success).toBe(false);
  });
});
