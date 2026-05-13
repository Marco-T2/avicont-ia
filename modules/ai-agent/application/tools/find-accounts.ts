import type { AccountsLookupPort, Account } from "../../domain/ports/accounts-lookup.port";
import type { OrgSettingsService } from "@/modules/org-settings/presentation/server";
import type {
  FindAccountsResult,
  FindAccountsResultItem,
} from "../../domain/tools/tool-output.types";

// ── Executor ──

const RESULT_CAP = 20;

export interface FindAccountsByPurposeDeps {
  accountsLookup: AccountsLookupPort;
  orgSettingsService?: OrgSettingsService;
}

/**
 * Implementación del executor de findAccountsByPurpose.
 * REQ-004: consume AccountsLookupPort en lugar de PrismaAccountsRepo directo.
 * Value imports deferred via dynamic import() — see balance-sheet-analysis sister.
 */
export async function executeFindAccountsByPurpose(
  organizationId: string,
  input: { purpose: "expense" | "bank" | "cash"; query?: string },
  deps: FindAccountsByPurposeDeps,
): Promise<FindAccountsResult> {
  const accountsLookup = deps.accountsLookup;
  let orgSettingsService = deps.orgSettingsService;
  if (!orgSettingsService) {
    const { makeOrgSettingsService } = await import("@/modules/org-settings/presentation/server");
    orgSettingsService = makeOrgSettingsService();
  }

  if (input.purpose === "bank" || input.purpose === "cash") {
    const settings = (await orgSettingsService.getOrCreate(organizationId)).toSnapshot();
    const configuredIds =
      input.purpose === "bank"
        ? settings.defaultBankAccountIds
        : settings.defaultCashAccountIds;

    if (configuredIds.length > 0) {
      const accounts = await accountsLookup.findManyByIds(organizationId, configuredIds);
      const usable = accounts.filter((a) => a.isDetail);
      if (usable.length > 0) {
        const filtered = applyQuery(usable, input.query);
        return {
          accounts: filtered.slice(0, RESULT_CAP).map((a) => toResultItem(a, true)),
          configRequired: false,
        };
      }
    }
  }

  const heuristicAccounts = await runHeuristic(
    organizationId,
    input.purpose,
    accountsLookup,
    orgSettingsService,
  );
  const filtered = applyQuery(heuristicAccounts, input.query);

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
  accountsLookup: AccountsLookupPort,
  orgSettingsService: OrgSettingsService,
): Promise<Account[]> {
  if (purpose === "expense") {
    const all = await accountsLookup.findByType(organizationId, "GASTO");
    return all.filter((a) => a.isDetail);
  }

  const settings = (await orgSettingsService.getOrCreate(organizationId)).toSnapshot();
  const parentCodes =
    purpose === "cash"
      ? [settings.cashParentCode, settings.pettyCashParentCode]
      : [settings.bankParentCode];

  return accountsLookup.findDetailChildrenByParentCodes(organizationId, parentCodes);
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
