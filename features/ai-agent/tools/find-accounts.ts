import "server-only";
import { z } from "zod";
import { defineTool } from "../llm";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { OrgSettingsService } from "@/features/org-settings/org-settings.service";
import type { Account } from "@/generated/prisma/client";

// ── Tool definition ──

export const findAccountsByPurposeTool = defineTool({
  name: "findAccountsByPurpose",
  description:
    "Lista cuentas contables disponibles para un propósito (gasto, banco o caja). " +
    "Devuelve hasta 20 cuentas. Si la organización tiene cuentas marcadas como default " +
    "para ese propósito, vienen primero con isDefault=true. Si no hay configuración y " +
    "tampoco se encuentran cuentas por heurística (descendientes del parent code), " +
    "devuelve configRequired=true para que el LLM avise al usuario.",
  inputSchema: z.object({
    purpose: z
      .enum(["expense", "bank", "cash"])
      .describe("Propósito contable: 'expense' = gasto, 'bank' = banco, 'cash' = caja/efectivo"),
    query: z
      .string()
      .optional()
      .describe("Filtro opcional case-insensitive sobre nombre y código (contains)"),
  }),
});

// ── Output type ──

export interface FindAccountsResultItem {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  requiresContact: boolean;
}

export interface FindAccountsResult {
  accounts: FindAccountsResultItem[];
  configRequired: boolean;
  message?: string;
}

// ── Executor ──

const RESULT_CAP = 20;

export interface FindAccountsByPurposeDeps {
  accountsRepo?: AccountsRepository;
  orgSettingsService?: OrgSettingsService;
}

export async function executeFindAccountsByPurpose(
  organizationId: string,
  input: { purpose: "expense" | "bank" | "cash"; query?: string },
  deps: FindAccountsByPurposeDeps = {},
): Promise<FindAccountsResult> {
  const accountsRepo = deps.accountsRepo ?? new AccountsRepository();
  const orgSettingsService = deps.orgSettingsService ?? new OrgSettingsService();

  // Capa 1 — Defaults curados por la org (solo bank y cash; expense no tiene defaults).
  if (input.purpose === "bank" || input.purpose === "cash") {
    const settings = await orgSettingsService.getOrCreate(organizationId);
    const configuredIds =
      input.purpose === "bank"
        ? settings.defaultBankAccountIds
        : settings.defaultCashAccountIds;

    if (configuredIds.length > 0) {
      const accounts = await accountsRepo.findManyByIds(organizationId, configuredIds);
      // Filtrado silencioso: cuentas desactivadas después de configurarse se ocultan
      // sin error (el contador puede haber desactivado una cuenta sin re-configurar).
      const usable = accounts.filter((a) => a.isActive && a.isDetail);
      if (usable.length > 0) {
        const filtered = applyQuery(usable, input.query);
        return {
          accounts: filtered.slice(0, RESULT_CAP).map((a) => toResultItem(a, true)),
          configRequired: false,
        };
      }
      // Todos los defaults están desactivados — la configuración apunta a un conjunto
      // vacío de cuentas usables. Caemos a heurística: hay cuentas válidas en el plan,
      // solo que ninguna fue configurada como default. Mejor servir esas que retornar
      // vacío engañando al LLM con configRequired (que existe configuración).
    }
  }

  // Capa 2 — Heurística por parent code (bank/cash) o type (expense).
  const heuristicAccounts = await runHeuristic(
    organizationId,
    input.purpose,
    accountsRepo,
    orgSettingsService,
  );
  const filtered = applyQuery(heuristicAccounts, input.query);

  // Capa 3 — Si la heurística vuelve vacía, indicar al LLM que requiere configuración.
  if (filtered.length === 0) {
    return {
      accounts: [],
      configRequired: true,
      message: configRequiredMessage(input.purpose),
    };
  }

  return {
    accounts: filtered.slice(0, RESULT_CAP).map((a) => toResultItem(a, false)),
    configRequired: false,
  };
}

// ── Helpers internos ──

async function runHeuristic(
  organizationId: string,
  purpose: "expense" | "bank" | "cash",
  accountsRepo: AccountsRepository,
  orgSettingsService: OrgSettingsService,
): Promise<Account[]> {
  if (purpose === "expense") {
    const all = await accountsRepo.findByType(organizationId, "GASTO");
    return all.filter((a) => a.isActive && a.isDetail);
  }

  const settings = await orgSettingsService.getOrCreate(organizationId);
  const parentCodes =
    purpose === "cash"
      ? [settings.cashParentCode, settings.pettyCashParentCode]
      : [settings.bankParentCode];

  return accountsRepo.findDetailChildrenByParentCodes(organizationId, parentCodes);
}

function applyQuery(accounts: Account[], query: string | undefined): Account[] {
  if (!query) return accounts;
  const q = query.toLowerCase();
  return accounts.filter(
    (a) => a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q),
  );
}

function toResultItem(account: Account, isDefault: boolean): FindAccountsResultItem {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    isDefault,
    requiresContact: account.requiresContact,
  };
}

function configRequiredMessage(purpose: "expense" | "bank" | "cash"): string {
  const label = purpose === "expense" ? "gasto" : purpose === "bank" ? "banco" : "caja";
  return `No se encontraron cuentas de ${label}. Pedile al admin que configure el plan de cuentas o las cuentas default en Settings → Contabilidad.`;
}
