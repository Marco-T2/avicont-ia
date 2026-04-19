/**
 * T2.3 — DocumentSignatureConfig validation tests.
 *
 * Covers REQ-OP.5:
 *   documentType  — one of 8 DocumentPrintType enum values
 *   labels        — may be empty, no duplicates, each must be a SignatureLabel
 *   showReceiverRow — boolean
 */
import { describe, it, expect } from "vitest";
import {
  updateSignatureConfigSchema,
  signatureLabelEnum,
  documentPrintTypeEnum,
} from "../document-signature-config.validation";

describe("updateSignatureConfigSchema — valid inputs", () => {
  it("passes with 3 ordered unique labels + showReceiverRow=true", () => {
    const result = updateSignatureConfigSchema.safeParse({
      labels: ["ELABORADO", "APROBADO", "VISTO_BUENO"],
      showReceiverRow: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Order must be preserved exactly
      expect(result.data.labels).toEqual([
        "ELABORADO",
        "APROBADO",
        "VISTO_BUENO",
      ]);
      expect(result.data.showReceiverRow).toBe(true);
    }
  });

  it("passes with empty labels array + showReceiverRow=false", () => {
    const result = updateSignatureConfigSchema.safeParse({
      labels: [],
      showReceiverRow: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.labels).toEqual([]);
    }
  });

  it("preserves label order exactly as submitted", () => {
    const result = updateSignatureConfigSchema.safeParse({
      labels: ["CONTABILIZADO", "REGISTRADO", "REVISADO", "PROPIETARIO"],
      showReceiverRow: false,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.labels).toEqual([
        "CONTABILIZADO",
        "REGISTRADO",
        "REVISADO",
        "PROPIETARIO",
      ]);
    }
  });
});

describe("updateSignatureConfigSchema — invalid inputs", () => {
  it("rejects duplicate labels", () => {
    const result = updateSignatureConfigSchema.safeParse({
      labels: ["ELABORADO", "ELABORADO"],
      showReceiverRow: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("labels");
    }
  });

  it("rejects unknown label enum value", () => {
    const result = updateSignatureConfigSchema.safeParse({
      labels: ["ELABORADO", "UNKNOWN_LABEL"],
      showReceiverRow: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects showReceiverRow non-boolean", () => {
    const result = updateSignatureConfigSchema.safeParse({
      labels: [],
      showReceiverRow: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing showReceiverRow (required field)", () => {
    const result = updateSignatureConfigSchema.safeParse({ labels: [] });
    expect(result.success).toBe(false);
  });
});

describe("documentPrintTypeEnum", () => {
  it("accepts all 8 valid DocumentPrintType values", () => {
    for (const v of [
      "BALANCE_GENERAL",
      "ESTADO_RESULTADOS",
      "COMPROBANTE",
      "DESPACHO",
      "VENTA",
      "COMPRA",
      "COBRO",
      "PAGO",
    ]) {
      expect(documentPrintTypeEnum.safeParse(v).success).toBe(true);
    }
  });

  it("rejects 'FACTURA' (not a DocumentPrintType)", () => {
    expect(documentPrintTypeEnum.safeParse("FACTURA").success).toBe(false);
  });

  it("rejects lowercase variants", () => {
    expect(documentPrintTypeEnum.safeParse("venta").success).toBe(false);
  });
});

describe("signatureLabelEnum", () => {
  it("accepts all 7 valid SignatureLabel values", () => {
    for (const v of [
      "ELABORADO",
      "APROBADO",
      "VISTO_BUENO",
      "PROPIETARIO",
      "REVISADO",
      "REGISTRADO",
      "CONTABILIZADO",
    ]) {
      expect(signatureLabelEnum.safeParse(v).success).toBe(true);
    }
  });

  it("rejects unknown signature label", () => {
    expect(signatureLabelEnum.safeParse("FIRMADO").success).toBe(false);
  });
});
