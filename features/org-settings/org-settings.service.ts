import "server-only";
import { OrgSettingsRepository } from "./org-settings.repository";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import {
  ValidationError,
  ORG_SETTINGS_ACCOUNT_NOT_FOUND,
  ORG_SETTINGS_ACCOUNT_NOT_USABLE,
  ORG_SETTINGS_ACCOUNT_WRONG_PARENT,
} from "@/features/shared/errors";
import type { Account } from "@/generated/prisma/client";
import type { OrgSettings, UpdateOrgSettingsInput } from "./org-settings.types";

export class OrgSettingsService {
  private readonly repo: OrgSettingsRepository;
  private readonly accountsRepo: AccountsRepository;

  constructor(repo?: OrgSettingsRepository, accountsRepo?: AccountsRepository) {
    this.repo = repo ?? new OrgSettingsRepository();
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
  }

  // ── Obtener configuración de la organización, creando con valores por defecto si no existe ──

  async getOrCreate(organizationId: string): Promise<OrgSettings> {
    const existing = await this.repo.findByOrgId(organizationId);
    if (existing) return existing;
    return this.repo.create(organizationId);
  }

  // ── Actualizar configuración de la organización ──

  async update(organizationId: string, input: UpdateOrgSettingsInput): Promise<OrgSettings> {
    // Asegurar que la fila de configuración existe antes de actualizar
    const settings = await this.getOrCreate(organizationId);

    // Validación de listas curadas de cuentas (consumidas por la tool findAccountsByPurpose
    // del agente IA). Los account codes legacy NO se validan acá — fuera de scope.
    if (input.defaultCashAccountIds !== undefined) {
      await this.validateAccountIds(
        organizationId,
        input.defaultCashAccountIds,
        [settings.cashParentCode, settings.pettyCashParentCode],
        "caja",
      );
    }
    if (input.defaultBankAccountIds !== undefined) {
      await this.validateAccountIds(
        organizationId,
        input.defaultBankAccountIds,
        [settings.bankParentCode],
        "banco",
      );
    }

    return this.repo.update(organizationId, input);
  }

  // ── Validación interna de IDs configurados ──

  private async validateAccountIds(
    organizationId: string,
    ids: string[],
    parentCodes: string[],
    purposeLabel: string,
  ): Promise<void> {
    if (ids.length === 0) return; // vaciar la lista es operación válida

    const uniqueIds = Array.from(new Set(ids));
    const accounts = await this.accountsRepo.findManyByIds(organizationId, uniqueIds);

    // 1. Existencia (todas las IDs deben mapear a cuentas reales de la org)
    if (accounts.length !== uniqueIds.length) {
      const found = new Set(accounts.map((a) => a.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new ValidationError(
        `No se encontraron cuentas de ${purposeLabel}: ${missing.join(", ")}`,
        ORG_SETTINGS_ACCOUNT_NOT_FOUND,
        { missing },
      );
    }

    // 2. Cuentas usables (detail + activas)
    const notUsable = accounts.filter((a) => !a.isDetail || !a.isActive);
    if (notUsable.length > 0) {
      throw new ValidationError(
        `Cuentas de ${purposeLabel} no usables (deben ser de detalle y activas): ${formatAccountList(notUsable)}`,
        ORG_SETTINGS_ACCOUNT_NOT_USABLE,
        { notUsable: notUsable.map((a) => a.id) },
      );
    }

    // 3. Coherencia semántica con el parent code apropiado
    const wrongParent = accounts.filter((a) => !descendsFromAny(a.code, parentCodes));
    if (wrongParent.length > 0) {
      throw new ValidationError(
        `Cuentas de ${purposeLabel} no descienden de ${parentCodes.join(" / ")}: ${formatAccountList(wrongParent)}`,
        ORG_SETTINGS_ACCOUNT_WRONG_PARENT,
        { wrongParent: wrongParent.map((a) => a.id) },
      );
    }
  }
}

function descendsFromAny(code: string, parentCodes: string[]): boolean {
  return parentCodes.some((pc) => code === pc || code.startsWith(`${pc}.`));
}

function formatAccountList(accounts: Account[]): string {
  return accounts.map((a) => `${a.code} ${a.name}`).join(", ");
}
