import { describe, it, expect } from "vitest";
import { OrgSettings } from "../org-settings.entity";

describe("OrgSettings entity", () => {
  describe("createDefault", () => {
    it("crea entity con orgId + defaults canónicos del schema Prisma", () => {
      const entity = OrgSettings.createDefault({
        id: "settings-1",
        organizationId: "org-1",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      });

      const snap = entity.toSnapshot();
      expect(snap.organizationId).toBe("org-1");
      expect(snap.cajaGeneralAccountCode).toBe("1.1.1.1");
      expect(snap.bancoAccountCode).toBe("1.1.2.1");
      expect(snap.cxcAccountCode).toBe("1.1.4.1");
      expect(snap.cxpAccountCode).toBe("2.1.1.1");
      expect(snap.roundingThreshold).toBe(0.7);
      expect(snap.cashParentCode).toBe("1.1.1");
      expect(snap.pettyCashParentCode).toBe("1.1.2");
      expect(snap.bankParentCode).toBe("1.1.3");
      expect(snap.fleteExpenseAccountCode).toBe("5.1.3");
      expect(snap.polloFaenadoCOGSAccountCode).toBe("5.1.1");
      expect(snap.itExpenseAccountCode).toBe("5.3.3");
      expect(snap.itPayableAccountCode).toBe("2.1.7");
      expect(snap.defaultCashAccountIds).toEqual([]);
      expect(snap.defaultBankAccountIds).toEqual([]);
    });
  });

  describe("fromPersistence", () => {
    it("rehidrata la entity desde props existentes preservando todos los campos", () => {
      const props = makeProps({
        cajaGeneralAccountCode: "1.1.1.99",
        roundingThreshold: 0.5,
        defaultCashAccountIds: ["acc-1", "acc-2"],
      });
      const entity = OrgSettings.fromPersistence(props);
      const snap = entity.toSnapshot();
      expect(snap.cajaGeneralAccountCode).toBe("1.1.1.99");
      expect(snap.roundingThreshold).toBe(0.5);
      expect(snap.defaultCashAccountIds).toEqual(["acc-1", "acc-2"]);
    });
  });

  describe("update", () => {
    it("aplica solo los campos definidos, dejando los demás intactos", () => {
      const entity = OrgSettings.fromPersistence(makeProps());
      const updated = entity.update({ cajaGeneralAccountCode: "1.1.1.99" });
      const snap = updated.toSnapshot();
      expect(snap.cajaGeneralAccountCode).toBe("1.1.1.99");
      expect(snap.bancoAccountCode).toBe("1.1.2.1"); // intacto
      expect(snap.roundingThreshold).toBe(0.7); // intacto
    });

    it("update es inmutable: devuelve nueva instancia, la original no cambia", () => {
      const entity = OrgSettings.fromPersistence(makeProps());
      const updated = entity.update({ cajaGeneralAccountCode: "1.1.1.99" });
      expect(entity.toSnapshot().cajaGeneralAccountCode).toBe("1.1.1.1");
      expect(updated.toSnapshot().cajaGeneralAccountCode).toBe("1.1.1.99");
      expect(updated).not.toBe(entity);
    });

    it("rechaza roundingThreshold fuera de [0,1] vía VO", () => {
      const entity = OrgSettings.fromPersistence(makeProps());
      expect(() => entity.update({ roundingThreshold: 1.5 })).toThrowError(
        expect.objectContaining({ code: "INVALID_ROUNDING_THRESHOLD" }),
      );
    });

    it("rechaza account codes vacíos vía VO", () => {
      const entity = OrgSettings.fromPersistence(makeProps());
      expect(() => entity.update({ cajaGeneralAccountCode: "  " })).toThrowError(
        expect.objectContaining({ code: "INVALID_ACCOUNT_CODE" }),
      );
    });

    it("acepta los campos opcionales fleteExpense y polloFaenadoCOGS", () => {
      const entity = OrgSettings.fromPersistence(makeProps());
      const updated = entity.update({
        fleteExpenseAccountCode: "5.1.3.1",
        polloFaenadoCOGSAccountCode: "5.1.1.1",
      });
      const snap = updated.toSnapshot();
      expect(snap.fleteExpenseAccountCode).toBe("5.1.3.1");
      expect(snap.polloFaenadoCOGSAccountCode).toBe("5.1.1.1");
    });

    it("permite reemplazar defaultCashAccountIds (incluyendo vaciar la lista)", () => {
      const entity = OrgSettings.fromPersistence(
        makeProps({ defaultCashAccountIds: ["acc-old"] }),
      );
      const updated = entity.update({ defaultCashAccountIds: ["acc-1", "acc-2"] });
      expect(updated.toSnapshot().defaultCashAccountIds).toEqual(["acc-1", "acc-2"]);

      const cleared = updated.update({ defaultCashAccountIds: [] });
      expect(cleared.toSnapshot().defaultCashAccountIds).toEqual([]);
    });
  });

  describe("getters tipados", () => {
    it("expone los parent codes como AccountCode VO para queries de dominio", () => {
      const entity = OrgSettings.fromPersistence(makeProps());
      expect(entity.cashParent.value).toBe("1.1.1");
      expect(entity.pettyCashParent.value).toBe("1.1.2");
      expect(entity.bankParent.value).toBe("1.1.3");
    });
  });
});

// ── Fixture ──

interface MakePropsOverrides {
  cajaGeneralAccountCode?: string;
  roundingThreshold?: number;
  defaultCashAccountIds?: string[];
  defaultBankAccountIds?: string[];
}

function makeProps(overrides: MakePropsOverrides = {}) {
  return {
    id: "settings-1",
    organizationId: "org-1",
    cajaGeneralAccountCode: "1.1.1.1",
    bancoAccountCode: "1.1.2.1",
    cxcAccountCode: "1.1.4.1",
    cxpAccountCode: "2.1.1.1",
    roundingThreshold: 0.7,
    cashParentCode: "1.1.1",
    pettyCashParentCode: "1.1.2",
    bankParentCode: "1.1.3",
    fleteExpenseAccountCode: "5.1.3",
    polloFaenadoCOGSAccountCode: "5.1.1",
    itExpenseAccountCode: "5.3.3",
    itPayableAccountCode: "2.1.7",
    defaultCashAccountIds: [] as string[],
    defaultBankAccountIds: [] as string[],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}
