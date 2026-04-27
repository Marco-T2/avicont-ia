import "server-only";
import { OrgSettings } from "../domain/org-settings.entity";
import type { UpdateOrgSettingsInput } from "../domain/org-settings.entity";
import type { OrgSettingsRepository } from "../domain/ports/org-settings.repository";
import type {
  AccountLookupPort,
  AccountReference,
} from "../domain/ports/account-lookup.port";
import { AccountCode } from "../domain/value-objects/account-code";
import {
  ORG_SETTINGS_ACCOUNT_NOT_FOUND,
  ORG_SETTINGS_ACCOUNT_NOT_USABLE,
  ORG_SETTINGS_ACCOUNT_WRONG_PARENT,
} from "../domain/errors/org-settings-errors";
import { ValidationError } from "@/features/shared/errors";

export class OrgSettingsService {
  constructor(
    private readonly repo: OrgSettingsRepository,
    private readonly accountLookup: AccountLookupPort,
  ) {}

  async getOrCreate(organizationId: string): Promise<OrgSettings> {
    const existing = await this.repo.findByOrgId(organizationId);
    if (existing) return existing;

    const now = new Date();
    const fresh = OrgSettings.createDefault({
      id: crypto.randomUUID(),
      organizationId,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.save(fresh);
    return fresh;
  }

  async update(
    organizationId: string,
    input: UpdateOrgSettingsInput,
  ): Promise<OrgSettings> {
    const settings = await this.getOrCreate(organizationId);

    if (input.defaultCashAccountIds !== undefined) {
      await this.validateAccountIds(
        organizationId,
        input.defaultCashAccountIds,
        [settings.cashParent, settings.pettyCashParent],
        "caja",
      );
    }
    if (input.defaultBankAccountIds !== undefined) {
      await this.validateAccountIds(
        organizationId,
        input.defaultBankAccountIds,
        [settings.bankParent],
        "banco",
      );
    }

    const updated = settings.update(input);
    await this.repo.update(updated);
    return updated;
  }

  private async validateAccountIds(
    organizationId: string,
    ids: string[],
    parents: AccountCode[],
    purposeLabel: string,
  ): Promise<void> {
    if (ids.length === 0) return; // vaciar la lista es operación válida

    const uniqueIds = Array.from(new Set(ids));
    const accounts = await this.accountLookup.findManyByIds(
      organizationId,
      uniqueIds,
    );

    if (accounts.length !== uniqueIds.length) {
      const found = new Set(accounts.map((a) => a.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new ValidationError(
        `No se encontraron cuentas de ${purposeLabel}: ${missing.join(", ")}`,
        ORG_SETTINGS_ACCOUNT_NOT_FOUND,
        { missing },
      );
    }

    const notUsable = accounts.filter((a) => !a.isDetail || !a.isActive);
    if (notUsable.length > 0) {
      throw new ValidationError(
        `Cuentas de ${purposeLabel} no usables (deben ser de detalle y activas): ${formatAccountList(notUsable)}`,
        ORG_SETTINGS_ACCOUNT_NOT_USABLE,
        { notUsable: notUsable.map((a) => a.id) },
      );
    }

    const wrongParent = accounts.filter(
      (a) => !AccountCode.of(a.code).descendsFromAny(parents),
    );
    if (wrongParent.length > 0) {
      throw new ValidationError(
        `Cuentas de ${purposeLabel} no descienden de ${parents.map((p) => p.value).join(" / ")}: ${formatAccountList(wrongParent)}`,
        ORG_SETTINGS_ACCOUNT_WRONG_PARENT,
        { wrongParent: wrongParent.map((a) => a.id) },
      );
    }
  }
}

function formatAccountList(accounts: AccountReference[]): string {
  return accounts.map((a) => `${a.code}`).join(", ");
}
