import { describe, it, expect } from "vitest";
import { Prisma, type OrgSettings as OrgSettingsRow } from "@/generated/prisma/client";
import { toDomain, toPersistenceCreate, toPersistenceUpdate } from "../org-settings.mapper";
import { OrgSettings } from "../../domain/org-settings.entity";

function makeRow(overrides: Partial<OrgSettingsRow> = {}): OrgSettingsRow {
  return {
    id: "settings-1",
    organizationId: "org-1",
    cajaGeneralAccountCode: "1.1.1.1",
    bancoAccountCode: "1.1.2.1",
    cxcAccountCode: "1.1.4.1",
    cxpAccountCode: "2.1.1.1",
    roundingThreshold: new Prisma.Decimal(0.7),
    cashParentCode: "1.1.1",
    pettyCashParentCode: "1.1.2",
    bankParentCode: "1.1.3",
    fleteExpenseAccountCode: "5.1.3",
    polloFaenadoCOGSAccountCode: "5.1.1",
    itExpenseAccountCode: "5.3.3",
    itPayableAccountCode: "2.1.7",
    defaultCashAccountIds: [],
    defaultBankAccountIds: [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("org-settings mapper", () => {
  describe("toDomain", () => {
    it("convierte un row Prisma a OrgSettings entity", () => {
      const row = makeRow({ cajaGeneralAccountCode: "1.1.1.99" });
      const entity = toDomain(row);
      expect(entity.toSnapshot().cajaGeneralAccountCode).toBe("1.1.1.99");
      expect(entity.toSnapshot().organizationId).toBe("org-1");
    });

    it("convierte el Decimal de roundingThreshold a number", () => {
      const row = makeRow({ roundingThreshold: new Prisma.Decimal(0.5) });
      const entity = toDomain(row);
      expect(entity.toSnapshot().roundingThreshold).toBe(0.5);
    });

    it("preserva los arrays defaultCashAccountIds / defaultBankAccountIds", () => {
      const row = makeRow({
        defaultCashAccountIds: ["acc-1", "acc-2"],
        defaultBankAccountIds: ["acc-3"],
      });
      const entity = toDomain(row);
      expect(entity.toSnapshot().defaultCashAccountIds).toEqual(["acc-1", "acc-2"]);
      expect(entity.toSnapshot().defaultBankAccountIds).toEqual(["acc-3"]);
    });
  });

  describe("toPersistenceCreate", () => {
    it("incluye TODOS los campos persistidos (incluido itExpense/itPayable)", () => {
      const entity = OrgSettings.fromPersistence({
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
        defaultCashAccountIds: [],
        defaultBankAccountIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const data = toPersistenceCreate(entity);
      expect(data.itExpenseAccountCode).toBe("5.3.3");
      expect(data.itPayableAccountCode).toBe("2.1.7");
      expect(data.organizationId).toBe("org-1");
    });
  });

  describe("toPersistenceUpdate", () => {
    it("NO incluye itExpenseAccountCode / itPayableAccountCode (read-only en este módulo)", () => {
      const entity = OrgSettings.fromPersistence({
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
        defaultCashAccountIds: [],
        defaultBankAccountIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const data = toPersistenceUpdate(entity);
      expect(data).not.toHaveProperty("itExpenseAccountCode");
      expect(data).not.toHaveProperty("itPayableAccountCode");
      expect(data.cajaGeneralAccountCode).toBe("1.1.1.1");
    });
  });
});
