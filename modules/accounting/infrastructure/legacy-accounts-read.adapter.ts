import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import type {
  AccountReadDto,
  AccountsReadPort,
} from "@/modules/accounting/domain/ports/accounts-read.port";

/**
 * Tx-less wrapper over `PrismaAccountsRepo.findById` (POC #10 C3-C Ciclo 2; POC #3e hex cutover).
 *
 * Implements `AccountsReadPort` for non-tx reads BEFORE the UoW tx opens
 * (parity with legacy `accountsRepo.findById` calls in journal.service.ts).
 * Narrow mapping inline drops the 15+ field `Account` row to the 5-field
 * `AccountReadDto` required by the journal use cases — refuerza observación
 * "narrowing como segunda función del wrapper" (Account 15+ → 5 fields).
 *
 * §13 lockeado en C3-C Ciclo 2 (shape verificado Step 0 pair 1, sin spike
 * ceremonial separado):
 *   - **Wrap-thin legacy**: paridad Ciclo 1 — heredamos shape del legacy
 *     `findById(orgId, id): Promise<Account | null>` y traducimos a dto
 *     narrow. Stop rule v4 monitorea drift.
 *   - **Constructor sin args, legacy singleton module-scope**: paridad Ciclo 1
 *     y C3-B write. C4 revisa DI cuando el composition root lo pida.
 *   - **Mapping inline (1 call-site)**: convention `helper-privado-al-módulo` —
 *     §11.1 no preventive. Promoción cuando emerja segundo call-site (C3-D
 *     UoW adapter o POC #11).
 *
 * Convention `infrastructure-adapter-naming` (lockeada C3-C):
 *   - Filename `legacy-*.adapter.ts` — accounting consume legacy, no posee la
 *     fila `accounts` (vive en `features/accounting/`).
 */

const prismaAccountsRepo = new PrismaAccountsRepo();

export class LegacyAccountsReadAdapter implements AccountsReadPort {
  async findById(
    organizationId: string,
    accountId: string,
  ): Promise<AccountReadDto | null> {
    const row = await prismaAccountsRepo.findById(organizationId, accountId);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      isActive: row.isActive,
      isDetail: row.isDetail,
      requiresContact: row.requiresContact,
    };
  }
}
