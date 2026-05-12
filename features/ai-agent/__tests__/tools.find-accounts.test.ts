/**
 * Tests del executor findAccountsByPurpose.
 *
 * Cubre la lógica de tres capas:
 *   1. Defaults curados en OrgSettings.defaultCash/BankAccountIds (solo bank/cash)
 *   2. Heurística por parent code (bank/cash) o type=GASTO (expense)
 *   3. configRequired=true cuando la heurística devuelve vacío
 *
 * Cuentas desactivadas después de configurarse se filtran silenciosamente
 * (decisión consciente — no romper UX si el contador desactiva sin re-configurar).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// El barrel del LLM importa gemini.ts que valida GEMINI_API_KEY al load.
// defineTool no necesita la API key, pero el side-effect del import dispara el guard.
vi.hoisted(() => {
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "test-key-for-vitest";
});

import { executeFindAccountsByPurpose } from "../tools/find-accounts";
import type { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import type { OrgSettingsService } from "@/modules/org-settings/presentation/server";
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
    parentId: null,
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

function makeDeps(opts?: {
  settings?: OrgSettings;
  manyByIds?: Account[];
  byParents?: Account[];
  byType?: Account[];
}) {
  const settings = opts?.settings ?? makeSettings();

  const orgSettingsService = {
    getOrCreate: vi.fn(async () => ({ toSnapshot: () => settings })),
  } as unknown as OrgSettingsService;

  const accountsRepo = {
    findManyByIds: vi.fn(async (_orgId: string, ids: string[]) => {
      const all = opts?.manyByIds ?? [];
      return all.filter((a) => ids.includes(a.id));
    }),
    findDetailChildrenByParentCodes: vi.fn(async () => opts?.byParents ?? []),
    findByType: vi.fn(async () => opts?.byType ?? []),
  } as unknown as PrismaAccountsRepo;

  return { accountsRepo, orgSettingsService };
}

// ── Capa 1: defaults curados ──

describe("findAccountsByPurpose — capa 1: defaults curados", () => {
  beforeEach(() => vi.clearAllMocks());

  it("usa defaultCashAccountIds cuando está configurado y marca isDefault=true", async () => {
    const a1 = makeAccount({ id: "acc-1", code: "1.1.1.1", name: "Caja General" });
    const a2 = makeAccount({ id: "acc-2", code: "1.1.2.5", name: "Caja Galpón A" });
    const deps = makeDeps({
      settings: makeSettings({ defaultCashAccountIds: ["acc-1", "acc-2"] }),
      manyByIds: [a1, a2],
    });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "cash" }, deps);

    expect(result.accounts).toHaveLength(2);
    expect(result.accounts.every((a) => a.isDefault)).toBe(true);
    expect(result.configRequired).toBe(false);
    // No debe consultar la heurística cuando hay defaults
    expect(deps.accountsRepo.findDetailChildrenByParentCodes).not.toHaveBeenCalled();
  });

  it("usa defaultBankAccountIds cuando está configurado", async () => {
    const a1 = makeAccount({ id: "b-1", code: "1.1.3.1", name: "Banco BCP" });
    const deps = makeDeps({
      settings: makeSettings({ defaultBankAccountIds: ["b-1"] }),
      manyByIds: [a1],
    });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "bank" }, deps);

    expect(result.accounts).toEqual([
      { id: "b-1", code: "1.1.3.1", name: "Banco BCP", isDefault: true, requiresContact: false },
    ]);
  });

  it("filtra silenciosamente cuentas desactivadas (sin error)", async () => {
    const active = makeAccount({ id: "acc-1", code: "1.1.1.1", isActive: true });
    const inactive = makeAccount({ id: "acc-2", code: "1.1.1.2", isActive: false });
    const deps = makeDeps({
      settings: makeSettings({ defaultCashAccountIds: ["acc-1", "acc-2"] }),
      manyByIds: [active, inactive],
    });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "cash" }, deps);

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].id).toBe("acc-1");
    expect(result.configRequired).toBe(false);
  });

  it("filtra silenciosamente cuentas no detail", async () => {
    const detail = makeAccount({ id: "acc-1", code: "1.1.1.1", isDetail: true });
    const nonDetail = makeAccount({ id: "acc-2", code: "1.1.1", isDetail: false });
    const deps = makeDeps({
      settings: makeSettings({ defaultCashAccountIds: ["acc-1", "acc-2"] }),
      manyByIds: [detail, nonDetail],
    });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "cash" }, deps);

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].id).toBe("acc-1");
  });

  it("NO consulta defaults para purpose=expense (caía a heurística directa)", async () => {
    const exp = makeAccount({ id: "e-1", code: "5.1.2", name: "Alimento", type: "GASTO" });
    const deps = makeDeps({
      settings: makeSettings({ defaultCashAccountIds: ["should-be-ignored"] }),
      byType: [exp],
    });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "expense" }, deps);

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].isDefault).toBe(false);
    // findManyByIds no debe haber sido llamado para purpose=expense
    expect(deps.accountsRepo.findManyByIds).not.toHaveBeenCalled();
    expect(deps.accountsRepo.findByType).toHaveBeenCalledWith("org-1", "GASTO");
  });
});

// ── Capa 2: heurística ──

describe("findAccountsByPurpose — capa 2: heurística por parent / type", () => {
  beforeEach(() => vi.clearAllMocks());

  it("cash usa cashParentCode + pettyCashParentCode", async () => {
    const acc = makeAccount({ id: "c-1", code: "1.1.1.1" });
    const deps = makeDeps({ byParents: [acc] });

    await executeFindAccountsByPurpose("org-1", { purpose: "cash" }, deps);

    expect(deps.accountsRepo.findDetailChildrenByParentCodes).toHaveBeenCalledWith(
      "org-1",
      ["1.1.1", "1.1.2"],
    );
  });

  it("bank usa bankParentCode", async () => {
    const acc = makeAccount({ id: "b-1", code: "1.1.3.1" });
    const deps = makeDeps({ byParents: [acc] });

    await executeFindAccountsByPurpose("org-1", { purpose: "bank" }, deps);

    expect(deps.accountsRepo.findDetailChildrenByParentCodes).toHaveBeenCalledWith(
      "org-1",
      ["1.1.3"],
    );
  });

  it("expense usa findByType('GASTO') filtrado a detail+activas", async () => {
    const ok = makeAccount({ id: "e-1", code: "5.1.2", type: "GASTO" });
    const inactive = makeAccount({ id: "e-2", code: "5.1.3", type: "GASTO", isActive: false });
    const nonDetail = makeAccount({ id: "e-3", code: "5.1", type: "GASTO", isDetail: false });
    const deps = makeDeps({ byType: [ok, inactive, nonDetail] });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "expense" }, deps);

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].id).toBe("e-1");
  });

  it("aplica query case-insensitive contra name y code", async () => {
    const a1 = makeAccount({ id: "e-1", code: "5.1.2", name: "Alimento Balanceado", type: "GASTO" });
    const a2 = makeAccount({ id: "e-2", code: "5.1.3", name: "Medicamentos", type: "GASTO" });
    const deps = makeDeps({ byType: [a1, a2] });

    const result = await executeFindAccountsByPurpose(
      "org-1",
      { purpose: "expense", query: "ALIMENTO" },
      deps,
    );

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].id).toBe("e-1");
  });

  it("limita resultados a 20", async () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeAccount({ id: `e-${i}`, code: `5.1.${i}`, type: "GASTO" }),
    );
    const deps = makeDeps({ byType: many });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "expense" }, deps);

    expect(result.accounts).toHaveLength(20);
  });
});

// ── Capa 3: configRequired ──

describe("findAccountsByPurpose — capa 3: configRequired", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve configRequired=true cuando heurística vuelve vacía (cash)", async () => {
    const deps = makeDeps({ byParents: [] });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "cash" }, deps);

    expect(result.accounts).toHaveLength(0);
    expect(result.configRequired).toBe(true);
    expect(result.message).toBeTruthy();
    expect(result.message).toContain("caja");
  });

  it("devuelve configRequired=true cuando heurística vuelve vacía (bank)", async () => {
    const deps = makeDeps({ byParents: [] });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "bank" }, deps);

    expect(result.configRequired).toBe(true);
    expect(result.message).toContain("banco");
  });

  it("devuelve configRequired=true cuando no hay cuentas de gasto", async () => {
    const deps = makeDeps({ byType: [] });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "expense" }, deps);

    expect(result.configRequired).toBe(true);
    expect(result.message).toContain("gasto");
  });

  it("cae a heurística cuando todas las cuentas configuradas como default están desactivadas", async () => {
    // Defaults configurados existen, pero todas están isActive=false → la rama de
    // defaults se salta y cae a la capa 2 (heurística por parent code), que sí
    // encuentra cuentas válidas en el plan. Decisión consciente: UX > strict
    // adherence a la config. configRequired sería engañoso (existe configuración).
    const inactive = makeAccount({ id: "acc-1", isActive: false });
    const heuristicAccount = makeAccount({
      id: "acc-h1",
      code: "1.1.1.1",
      name: "Caja Heurística",
    });
    const deps = makeDeps({
      settings: makeSettings({ defaultCashAccountIds: ["acc-1"] }),
      manyByIds: [inactive],
      byParents: [heuristicAccount], // heurística sí encuentra cuentas
    });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "cash" }, deps);

    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].id).toBe("acc-h1");
    expect(result.accounts[0].isDefault).toBe(false); // vino de heurística, no de defaults
    expect(result.configRequired).toBe(false);
  });

  it("devuelve configRequired=true cuando defaults desactivados Y heurística también vacía", async () => {
    const inactive = makeAccount({ id: "acc-1", isActive: false });
    const deps = makeDeps({
      settings: makeSettings({ defaultCashAccountIds: ["acc-1"] }),
      manyByIds: [inactive],
      byParents: [], // heurística también vacía
    });

    const result = await executeFindAccountsByPurpose("org-1", { purpose: "cash" }, deps);

    expect(result.accounts).toHaveLength(0);
    expect(result.configRequired).toBe(true);
    expect(result.message).toContain("caja");
  });
});
