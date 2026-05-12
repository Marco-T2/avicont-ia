import "server-only";
import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import type {
  AccountLookupPort,
  AccountReference,
} from "../domain/ports/account-lookup.port";

/**
 * Adapter que delega al hex `PrismaAccountsRepo` (POC #3e cutover). Mapea Account
 * row de Prisma → AccountReference (DTO local de org-settings) — extrae solo
 * los campos que el use case necesita.
 */
export class LegacyAccountLookupAdapter implements AccountLookupPort {
  constructor(private readonly repo: PrismaAccountsRepo = new PrismaAccountsRepo()) {}

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

  async findManyByCodes(
    organizationId: string,
    codes: string[],
  ): Promise<AccountReference[]> {
    const results = await Promise.all(
      codes.map((code) => this.repo.findByCode(organizationId, code)),
    );
    return results.flatMap((row) =>
      row
        ? [{ id: row.id, code: row.code, isDetail: row.isDetail, isActive: row.isActive }]
        : [],
    );
  }
}
