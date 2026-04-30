import { describe, it, expect } from "vitest";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  IvaPurchaseBookEntry,
  type IvaPurchaseBookEntryProps,
  type IvaPurchaseBookEntryInputs,
} from "../iva-purchase-book-entry.entity";
import { IvaCalcResult } from "../value-objects/iva-calc-result";
import { IvaBookReactivateNonVoided } from "../errors/iva-book-errors";

const M = (n: number) => MonetaryAmount.of(n);

function buildInputs(): IvaPurchaseBookEntryInputs {
  return {
    importeTotal: M(100),
    importeIce: M(0),
    importeIehd: M(0),
    importeIpj: M(0),
    tasas: M(0),
    otrosNoSujetos: M(0),
    exentos: M(0),
    tasaCero: M(0),
    codigoDescuentoAdicional: M(0),
    importeGiftCard: M(0),
  };
}

function buildCalcResult(): IvaCalcResult {
  return IvaCalcResult.of({
    subtotal: M(100),
    baseImponible: M(100),
    ivaAmount: M(13),
  });
}

function buildProps(
  overrides: Partial<IvaPurchaseBookEntryProps> = {},
): IvaPurchaseBookEntryProps {
  const now = new Date();
  return {
    id: "iva-purchase-1",
    organizationId: "org-1",
    fiscalPeriodId: "period-1",
    purchaseId: null,
    inputs: buildInputs(),
    calcResult: buildCalcResult(),
    fechaFactura: new Date("2026-04-30"),
    nitProveedor: "1234567",
    razonSocial: "Proveedor SA",
    numeroFactura: "F-001",
    codigoAutorizacion: "AUTH-001",
    codigoControl: "",
    tipoCompra: 1,
    status: "ACTIVE",
    notes: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const baseCreateInput = {
  organizationId: "org-1",
  fiscalPeriodId: "period-1",
  fechaFactura: new Date("2026-04-30"),
  nitProveedor: "1234567",
  razonSocial: "Proveedor SA",
  numeroFactura: "F-001",
  codigoAutorizacion: "AUTH-001",
  codigoControl: "",
  tipoCompra: 1,
  notes: null,
};

describe("IvaPurchaseBookEntry aggregate", () => {
  describe("create()", () => {
    it("crea un IvaPurchaseBookEntry en ACTIVE con id UUID generado", () => {
      const entry = IvaPurchaseBookEntry.create({
        ...baseCreateInput,
        inputs: buildInputs(),
        calcResult: buildCalcResult(),
      });
      expect(entry.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(entry.status).toBe("ACTIVE");
      expect(entry.organizationId).toBe("org-1");
      expect(entry.fiscalPeriodId).toBe("period-1");
      expect(entry.tipoCompra).toBe(1);
      expect(entry.fechaFactura).toEqual(new Date("2026-04-30"));
      expect(entry.nitProveedor).toBe("1234567");
      expect(entry.razonSocial).toBe("Proveedor SA");
      expect(entry.numeroFactura).toBe("F-001");
      expect(entry.codigoAutorizacion).toBe("AUTH-001");
      expect(entry.codigoControl).toBe("");
      expect(entry.notes).toBeNull();
    });

    it("setea purchaseId null cuando NO se pasa", () => {
      const entry = IvaPurchaseBookEntry.create({
        ...baseCreateInput,
        inputs: buildInputs(),
        calcResult: buildCalcResult(),
      });
      expect(entry.purchaseId).toBeNull();
    });

    it("setea purchaseId cuando se pasa", () => {
      const entry = IvaPurchaseBookEntry.create({
        ...baseCreateInput,
        purchaseId: "purchase-1",
        inputs: buildInputs(),
        calcResult: buildCalcResult(),
      });
      expect(entry.purchaseId).toBe("purchase-1");
    });

    it("createdAt === updatedAt al crear (mismo Date instance)", () => {
      const entry = IvaPurchaseBookEntry.create({
        ...baseCreateInput,
        inputs: buildInputs(),
        calcResult: buildCalcResult(),
      });
      expect(entry.createdAt).toEqual(entry.updatedAt);
    });

    it("preserva inputs + calcResult VOs exactamente como se pasan", () => {
      const inputs = buildInputs();
      const calcResult = buildCalcResult();
      const entry = IvaPurchaseBookEntry.create({
        ...baseCreateInput,
        inputs,
        calcResult,
      });
      expect(entry.inputs).toBe(inputs);
      expect(entry.calcResult).toBe(calcResult);
    });
  });

  describe("fromPersistence()", () => {
    it("reconstruye el aggregate sin alterar props", () => {
      const props = buildProps({
        id: "iva-purchase-existing",
        status: "VOIDED",
        tipoCompra: 2,
      });
      const entry = IvaPurchaseBookEntry.fromPersistence(props);
      expect(entry.id).toBe("iva-purchase-existing");
      expect(entry.status).toBe("VOIDED");
      expect(entry.organizationId).toBe(props.organizationId);
      expect(entry.fiscalPeriodId).toBe(props.fiscalPeriodId);
      expect(entry.tipoCompra).toBe(2);
      expect(entry.createdAt).toEqual(props.createdAt);
      expect(entry.updatedAt).toEqual(props.updatedAt);
    });
  });

  describe("void()", () => {
    it("transiciona ACTIVE → VOIDED y retorna nueva instancia (immutable)", () => {
      const entry = IvaPurchaseBookEntry.fromPersistence(
        buildProps({ status: "ACTIVE" }),
      );
      const voided = entry.void();
      expect(voided.status).toBe("VOIDED");
      expect(voided).not.toBe(entry);
      expect(entry.status).toBe("ACTIVE");
    });

    it("es idempotente sobre VOIDED (mirror legacy: repo update VOIDED→VOIDED no-op)", () => {
      const entry = IvaPurchaseBookEntry.fromPersistence(
        buildProps({ status: "VOIDED" }),
      );
      const voided = entry.void();
      expect(voided.status).toBe("VOIDED");
    });

    it("preserva createdAt; updatedAt es nueva Date instance", () => {
      const original = new Date(2026, 0, 1);
      const entry = IvaPurchaseBookEntry.fromPersistence(
        buildProps({
          status: "ACTIVE",
          createdAt: original,
          updatedAt: original,
        }),
      );
      const voided = entry.void();
      expect(voided.createdAt).toBe(original);
      expect(voided.updatedAt).toBeInstanceOf(Date);
      expect(voided.updatedAt).not.toBe(original);
    });
  });

  describe("reactivate()", () => {
    it("transiciona VOIDED → ACTIVE y retorna nueva instancia (immutable)", () => {
      const entry = IvaPurchaseBookEntry.fromPersistence(
        buildProps({ status: "VOIDED" }),
      );
      const reactivated = entry.reactivate();
      expect(reactivated.status).toBe("ACTIVE");
      expect(reactivated).not.toBe(entry);
      expect(entry.status).toBe("VOIDED");
    });

    it("rechaza reactivar desde ACTIVE (idempotency/sanidad guard) con entityType purchase", () => {
      const entry = IvaPurchaseBookEntry.fromPersistence(
        buildProps({ status: "ACTIVE" }),
      );
      expect(() => entry.reactivate()).toThrow(IvaBookReactivateNonVoided);
      try {
        entry.reactivate();
      } catch (err) {
        expect((err as IvaBookReactivateNonVoided).message).toContain(
          "Entrada de Libro de Compras",
        );
      }
    });

    it("preserva createdAt; updatedAt es nueva Date instance", () => {
      const original = new Date(2026, 0, 1);
      const entry = IvaPurchaseBookEntry.fromPersistence(
        buildProps({
          status: "VOIDED",
          createdAt: original,
          updatedAt: original,
        }),
      );
      const reactivated = entry.reactivate();
      expect(reactivated.createdAt).toBe(original);
      expect(reactivated.updatedAt).toBeInstanceOf(Date);
      expect(reactivated.updatedAt).not.toBe(original);
    });
  });
});
