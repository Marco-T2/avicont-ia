/**
 * Unit tests for OrgSettingsService (modules/org-settings) — porteados desde
 * features/org-settings/__tests__/org-settings.service.test.ts. Validan los
 * tres invariantes de defaultCashAccountIds / defaultBankAccountIds:
 * existencia, isDetail+isActive, descendencia del parent code apropiado.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrgSettingsService } from "../org-settings.service";
import type { OrgSettingsRepository } from "../../domain/ports/org-settings.repository";
import type {
  AccountLookupPort,
  AccountReference,
} from "../../domain/ports/account-lookup.port";
import { OrgSettings } from "../../domain/org-settings.entity";

// ── Fixtures ──

function makeEntity(overrides: Partial<{
  cashParentCode: string;
  pettyCashParentCode: string;
  bankParentCode: string;
  defaultCashAccountIds: string[];
  defaultBankAccountIds: string[];
}> = {}) {
  return OrgSettings.fromPersistence({
    id: "settings-1",
    organizationId: "org-1",
    cajaGeneralAccountCode: "1.1.1.1",
    bancoAccountCode: "1.1.2.1",
    cxcAccountCode: "1.1.4.1",
    cxpAccountCode: "2.1.1.1",
    roundingThreshold: 0.7,
    cashParentCode: overrides.cashParentCode ?? "1.1.1",
    pettyCashParentCode: overrides.pettyCashParentCode ?? "1.1.2",
    bankParentCode: overrides.bankParentCode ?? "1.1.3",
    fleteExpenseAccountCode: "5.1.3",
    polloFaenadoCOGSAccountCode: "5.1.1",
    itExpenseAccountCode: "5.3.3",
    itPayableAccountCode: "2.1.7",
    defaultCashAccountIds: overrides.defaultCashAccountIds ?? [],
    defaultBankAccountIds: overrides.defaultBankAccountIds ?? [],
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

function makeAccount(overrides: Partial<AccountReference> = {}): AccountReference {
  return {
    id: "acc-1",
    code: "1.1.1.1",
    isDetail: true,
    isActive: true,
    ...overrides,
  };
}

function makeDeps(opts?: {
  entity?: OrgSettings;
  accountsByIds?: AccountReference[];
}) {
  const entity = opts?.entity ?? makeEntity();

  const repo: OrgSettingsRepository = {
    findByOrgId: vi.fn(async () => entity),
    save: vi.fn(async () => undefined),
    update: vi.fn(async () => undefined),
  };

  const accountLookup: AccountLookupPort = {
    findManyByIds: vi.fn(async (_orgId: string, ids: string[]) => {
      const all = opts?.accountsByIds ?? [];
      return all.filter((a) => ids.includes(a.id));
    }),
    findManyByCodes: vi.fn(async () => []),
  };

  return { repo, accountLookup, entity };
}

// ── Tests ──

describe("OrgSettingsService.update — validación de defaultCashAccountIds / defaultBankAccountIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("defaultCashAccountIds", () => {
    it("rechaza IDs inexistentes con ORG_SETTINGS_ACCOUNT_NOT_FOUND", async () => {
      const { repo, accountLookup } = makeDeps({ accountsByIds: [] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-missing"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_FOUND" });
    });

    it("rechaza cuenta inactiva con ORG_SETTINGS_ACCOUNT_NOT_USABLE", async () => {
      const inactive = makeAccount({ id: "acc-1", code: "1.1.1.1", isActive: false });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [inactive] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_USABLE" });
    });

    it("rechaza cuenta no detail con ORG_SETTINGS_ACCOUNT_NOT_USABLE", async () => {
      const nonDetail = makeAccount({ id: "acc-1", code: "1.1.1", isDetail: false });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [nonDetail] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_USABLE" });
    });

    it("rechaza cuenta que no desciende de cashParentCode ni pettyCashParentCode con ORG_SETTINGS_ACCOUNT_WRONG_PARENT", async () => {
      const bankAccount = makeAccount({ id: "acc-1", code: "1.1.3.1" });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [bankAccount] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_WRONG_PARENT" });
    });

    it("acepta cuenta que desciende de cashParentCode (1.1.1.x)", async () => {
      const cashAccount = makeAccount({ id: "acc-1", code: "1.1.1.1" });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [cashAccount] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).resolves.toBeDefined();
    });

    it("acepta cuenta que desciende de pettyCashParentCode (1.1.2.x)", async () => {
      const pettyCash = makeAccount({ id: "acc-1", code: "1.1.2.1" });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [pettyCash] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).resolves.toBeDefined();
    });

    it("acepta lista vacía (clears the list) sin consultar accountLookup", async () => {
      const { repo, accountLookup } = makeDeps();
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultCashAccountIds: [] }),
      ).resolves.toBeDefined();
      expect(accountLookup.findManyByIds).not.toHaveBeenCalled();
    });
  });

  describe("defaultBankAccountIds", () => {
    it("rechaza cuenta que no desciende de bankParentCode con ORG_SETTINGS_ACCOUNT_WRONG_PARENT", async () => {
      const cashAccount = makeAccount({ id: "acc-1", code: "1.1.1.1" });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [cashAccount] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultBankAccountIds: ["acc-1"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_WRONG_PARENT" });
    });

    it("acepta cuenta que desciende de bankParentCode (1.1.3.x)", async () => {
      const bankAccount = makeAccount({ id: "acc-1", code: "1.1.3.1" });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [bankAccount] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultBankAccountIds: ["acc-1"] }),
      ).resolves.toBeDefined();
    });
  });

  describe("alcance de la validación", () => {
    it("no consulta findManyByIds cuando solo se actualizan account codes single", async () => {
      // findManyByCodes SÍ se llama (validación server-side de codes single),
      // pero findManyByIds — la validación legacy de defaultCash/BankAccountIds —
      // NO debe dispararse para un update que solo trae account codes.
      const { repo, accountLookup } = makeDeps();
      (accountLookup.findManyByCodes as ReturnType<typeof vi.fn>).mockResolvedValue([
        makeAccount({ id: "acc-1", code: "1.1.1.99", isDetail: true }),
      ]);
      const service = new OrgSettingsService(repo, accountLookup);

      await service.update("org-1", { cajaGeneralAccountCode: "1.1.1.99" });

      expect(accountLookup.findManyByIds).not.toHaveBeenCalled();
    });

    it("acepta múltiples IDs válidos en una sola actualización", async () => {
      const a1 = makeAccount({ id: "acc-1", code: "1.1.1.1" });
      const a2 = makeAccount({ id: "acc-2", code: "1.1.2.5" });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [a1, a2] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1", "acc-2"] }),
      ).resolves.toBeDefined();
    });

    it("reporta TODOS los IDs faltantes en details", async () => {
      const found = makeAccount({ id: "acc-1", code: "1.1.1.1" });
      const { repo, accountLookup } = makeDeps({ accountsByIds: [found] });
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", {
          defaultCashAccountIds: ["acc-1", "acc-missing-1", "acc-missing-2"],
        }),
      ).rejects.toMatchObject({
        code: "ORG_SETTINGS_ACCOUNT_NOT_FOUND",
        details: { missing: ["acc-missing-1", "acc-missing-2"] },
      });
    });
  });

  describe("validación de account codes single (defense-in-depth server-side)", () => {
    function makeCodeDeps(accountsByCodes: AccountReference[]) {
      const entity = makeEntity();
      const repo: OrgSettingsRepository = {
        findByOrgId: vi.fn(async () => entity),
        save: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined),
      };
      const accountLookup: AccountLookupPort = {
        findManyByIds: vi.fn(async () => []),
        findManyByCodes: vi.fn(async (_orgId: string, codes: string[]) =>
          accountsByCodes.filter((a) => codes.includes(a.code)),
        ),
      };
      return { repo, accountLookup };
    }

    it("acepta update con code válido (isDetail:true) para campo posteable", async () => {
      const { repo, accountLookup } = makeCodeDeps([
        makeAccount({ id: "acc-banco", code: "1.1.3.2", isDetail: true }),
      ]);
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { bancoAccountCode: "1.1.3.2" }),
      ).resolves.toBeDefined();
      expect(accountLookup.findManyByCodes).toHaveBeenCalledWith("org-1", [
        "1.1.3.2",
      ]);
      expect(repo.update).toHaveBeenCalledOnce();
    });

    it("rechaza code inexistente con ORG_SETTINGS_ACCOUNT_NOT_FOUND", async () => {
      const { repo, accountLookup } = makeCodeDeps([]); // findManyByCodes → []
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { cajaGeneralAccountCode: "9.9.9.9" }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_FOUND" });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rechaza code isDetail:false para campo posteable con ORG_SETTINGS_ACCOUNT_NOT_USABLE", async () => {
      const { repo, accountLookup } = makeCodeDeps([
        makeAccount({ id: "acc-parent", code: "1.1.1", isDetail: false }),
      ]);
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { cajaGeneralAccountCode: "1.1.1" }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_USABLE" });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rechaza code isDetail:true para campo parent con ORG_SETTINGS_ACCOUNT_NOT_USABLE", async () => {
      const { repo, accountLookup } = makeCodeDeps([
        makeAccount({ id: "acc-leaf", code: "1.1.1.1", isDetail: true }),
      ]);
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { cashParentCode: "1.1.1.1" }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_USABLE" });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("rechaza code inactivo para campo posteable con ORG_SETTINGS_ACCOUNT_NOT_USABLE", async () => {
      const { repo, accountLookup } = makeCodeDeps([
        makeAccount({
          id: "acc-inactive",
          code: "1.1.3.2",
          isDetail: true,
          isActive: false,
        }),
      ]);
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", { bancoAccountCode: "1.1.3.2" }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_USABLE" });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it("valida múltiples codes (posteables + parents) en una sola llamada a findManyByCodes", async () => {
      const { repo, accountLookup } = makeCodeDeps([
        makeAccount({ id: "acc-1", code: "1.1.3.2", isDetail: true }),
        makeAccount({ id: "acc-2", code: "1.1.3", isDetail: false }),
      ]);
      const service = new OrgSettingsService(repo, accountLookup);

      await expect(
        service.update("org-1", {
          bancoAccountCode: "1.1.3.2",
          bankParentCode: "1.1.3",
        }),
      ).resolves.toBeDefined();
      expect(accountLookup.findManyByCodes).toHaveBeenCalledTimes(1);
      const [, codesArg] = (accountLookup.findManyByCodes as ReturnType<typeof vi.fn>)
        .mock.calls[0];
      expect([...(codesArg as string[])].sort()).toEqual(["1.1.3", "1.1.3.2"]);
    });

    it("no consulta findManyByCodes cuando el input no trae account codes", async () => {
      const { repo, accountLookup } = makeCodeDeps([]);
      const service = new OrgSettingsService(repo, accountLookup);

      await service.update("org-1", { roundingThreshold: 0.5 });

      expect(accountLookup.findManyByCodes).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledOnce();
    });
  });

  describe("getOrCreate", () => {
    it("devuelve la entity existente si la fila existe", async () => {
      const entity = makeEntity({ defaultCashAccountIds: ["acc-1"] });
      const { repo, accountLookup } = makeDeps({ entity });
      const service = new OrgSettingsService(repo, accountLookup);

      const result = await service.getOrCreate("org-1");
      expect(result.toSnapshot().defaultCashAccountIds).toEqual(["acc-1"]);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it("crea con defaults canónicos cuando no existe la fila", async () => {
      const repo: OrgSettingsRepository = {
        findByOrgId: vi.fn(async () => null),
        save: vi.fn(async () => undefined),
        update: vi.fn(async () => undefined),
      };
      const accountLookup: AccountLookupPort = {
        findManyByIds: vi.fn(async () => []),
        findManyByCodes: vi.fn(async () => []),
      };
      const service = new OrgSettingsService(repo, accountLookup);

      const result = await service.getOrCreate("org-1");
      expect(result.toSnapshot().organizationId).toBe("org-1");
      expect(result.toSnapshot().cajaGeneralAccountCode).toBe("1.1.1.1");
      expect(result.toSnapshot().roundingThreshold).toBe(0.7);
      expect(repo.save).toHaveBeenCalledOnce();
    });
  });
});
