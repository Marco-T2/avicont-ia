/**
 * Unit tests for OrgSettingsService — validación de defaultCashAccountIds y defaultBankAccountIds.
 *
 * Estos campos viajan en el PATCH de OrgSettings y son consumidos por la tool
 * findAccountsByPurpose del agente IA. La validación verifica:
 * - Existencia (ID en la org)
 * - isDetail=true, isActive=true
 * - Descendencia del parent code apropiado (cashParentCode/pettyCashParentCode para caja,
 *   bankParentCode para banco)
 *
 * Los account codes legacy (cajaGeneralAccountCode, etc.) NO se validan — decisión
 * consciente, fuera de scope del PR de captura asistida.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrgSettingsService } from "../org-settings.service";
import type { OrgSettingsRepository } from "../org-settings.repository";
import type { AccountsRepository } from "@/features/accounting/accounts.repository";
import type { Account, OrgSettings } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";

// ── Fixtures ──

function makeSettings(overrides: Partial<OrgSettings> = {}): OrgSettings {
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: "acc-1",
    code: "1.1.1.1",
    name: "Caja General",
    type: "ACTIVO",
    nature: "DEUDORA",
    subtype: "ACTIVO_CORRIENTE",
    parentId: "parent-cash",
    level: 4,
    isDetail: true,
    requiresContact: false,
    description: null,
    isActive: true,
    isContraAccount: false,
    organizationId: "org-1",
    ...overrides,
  };
}

function makeRepos(opts?: {
  settings?: OrgSettings;
  accountsByIds?: Account[];
}) {
  const settings = opts?.settings ?? makeSettings();
  const settingsRepo = {
    findByOrgId: vi.fn(async () => settings),
    create: vi.fn(async () => settings),
    update: vi.fn(async (_orgId: string, data: object) => ({ ...settings, ...(data as Partial<OrgSettings>) })),
  } as unknown as OrgSettingsRepository;

  const accountsRepo = {
    findManyByIds: vi.fn(async (_orgId: string, ids: string[]) => {
      const all = opts?.accountsByIds ?? [];
      return all.filter((a) => ids.includes(a.id));
    }),
  } as unknown as AccountsRepository;

  return { settingsRepo, accountsRepo };
}

// ── Tests ──

describe("OrgSettingsService.update — validación de defaultCashAccountIds / defaultBankAccountIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("defaultCashAccountIds", () => {
    it("rechaza IDs inexistentes con ORG_SETTINGS_ACCOUNT_NOT_FOUND", async () => {
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-missing"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_FOUND" });
    });

    it("rechaza cuenta inactiva con ORG_SETTINGS_ACCOUNT_NOT_USABLE", async () => {
      const inactive = makeAccount({ id: "acc-1", code: "1.1.1.1", isActive: false });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [inactive] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_USABLE" });
    });

    it("rechaza cuenta no detail con ORG_SETTINGS_ACCOUNT_NOT_USABLE", async () => {
      const nonDetail = makeAccount({ id: "acc-1", code: "1.1.1", isDetail: false });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [nonDetail] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_NOT_USABLE" });
    });

    it("rechaza cuenta que no desciende de cashParentCode ni pettyCashParentCode con ORG_SETTINGS_ACCOUNT_WRONG_PARENT", async () => {
      // Cuenta de banco (1.1.3.x) intentando ser configurada como caja
      const bankAccount = makeAccount({ id: "acc-1", code: "1.1.3.1", name: "Banco BCP" });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [bankAccount] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_WRONG_PARENT" });
    });

    it("acepta cuenta que desciende de cashParentCode (1.1.1.x)", async () => {
      const cashAccount = makeAccount({ id: "acc-1", code: "1.1.1.1", name: "Caja General" });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [cashAccount] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).resolves.toBeDefined();
    });

    it("acepta cuenta que desciende de pettyCashParentCode (1.1.2.x)", async () => {
      const pettyCash = makeAccount({ id: "acc-1", code: "1.1.2.1", name: "Caja Chica Galpón A" });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [pettyCash] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1"] }),
      ).resolves.toBeDefined();
    });

    it("acepta lista vacía (clears the list)", async () => {
      const { settingsRepo, accountsRepo } = makeRepos();
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultCashAccountIds: [] }),
      ).resolves.toBeDefined();
      // No debería consultar accountsRepo cuando la lista viene vacía
      expect(accountsRepo.findManyByIds).not.toHaveBeenCalled();
    });
  });

  describe("defaultBankAccountIds", () => {
    it("rechaza cuenta que no desciende de bankParentCode con ORG_SETTINGS_ACCOUNT_WRONG_PARENT", async () => {
      // Cuenta de caja (1.1.1.x) intentando ser configurada como banco
      const cashAccount = makeAccount({ id: "acc-1", code: "1.1.1.1", name: "Caja General" });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [cashAccount] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultBankAccountIds: ["acc-1"] }),
      ).rejects.toMatchObject({ code: "ORG_SETTINGS_ACCOUNT_WRONG_PARENT" });
    });

    it("acepta cuenta que desciende de bankParentCode (1.1.3.x)", async () => {
      const bankAccount = makeAccount({ id: "acc-1", code: "1.1.3.1", name: "Banco BCP Cta Cte" });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [bankAccount] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultBankAccountIds: ["acc-1"] }),
      ).resolves.toBeDefined();
    });
  });

  describe("alcance de la validación", () => {
    it("no consulta accountsRepo cuando solo se actualizan codes legacy", async () => {
      const { settingsRepo, accountsRepo } = makeRepos();
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await service.update("org-1", { cajaGeneralAccountCode: "1.1.1.99" });

      expect(accountsRepo.findManyByIds).not.toHaveBeenCalled();
    });

    it("acepta múltiples IDs válidos en una sola actualización", async () => {
      const a1 = makeAccount({ id: "acc-1", code: "1.1.1.1" });
      const a2 = makeAccount({ id: "acc-2", code: "1.1.2.5" });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [a1, a2] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

      await expect(
        service.update("org-1", { defaultCashAccountIds: ["acc-1", "acc-2"] }),
      ).resolves.toBeDefined();
    });

    it("reporta TODOS los IDs faltantes en details", async () => {
      const found = makeAccount({ id: "acc-1", code: "1.1.1.1" });
      const { settingsRepo, accountsRepo } = makeRepos({ accountsByIds: [found] });
      const service = new OrgSettingsService(settingsRepo, accountsRepo);

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
});
