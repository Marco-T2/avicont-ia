import "server-only";
import { AccountsRepository } from "@/features/accounting/server";
import type {
  AccountLookupPort,
  AccountReference,
} from "../domain/ports/account-lookup.port";

/**
 * Adapter que delega al legacy `features/accounting/AccountsRepository`. Se
 * reemplazará por un port cuando accounting migre al patrón hexagonal (escalón
 * 9 de la escalera). Hasta entonces, mapea Account row de Prisma → AccountReference
 * (DTO local de org-settings) — extrae solo los campos que el use case necesita.
 */
export class LegacyAccountLookupAdapter implements AccountLookupPort {
  constructor(private readonly repo: AccountsRepository = new AccountsRepository()) {}

  async findManyByIds(
    organizationId: string,
    ids: string[],
  ): Promise<AccountReference[]> {
    const rows = await this.repo.findManyByIds(organizationId, ids);
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      isDetail: row.isDetail,
      isActive: row.isActive,
    }));
  }
}
