import "server-only";
import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import type {
  AccountsLookupPort,
  Account,
} from "../domain/ports/accounts-lookup.port";
import type { Account as PrismaAccount, AccountType } from "@/generated/prisma/client";

/**
 * LegacyAccountsAdapter — implements AccountsLookupPort by wrapping
 * PrismaAccountsRepo from @/modules/accounting/infrastructure.
 *
 * REQ-004: insulation point — this is the ONE location in modules/ai-agent
 * that imports from @/modules/accounting/infrastructure. All application
 * code consumes AccountsLookupPort.
 *
 * Narrow surface: 3 methods only (findManyByIds, findByType,
 * findDetailChildrenByParentCodes) — the agent does not need the rest of
 * PrismaAccountsRepo's 15-method surface. If a future accounting refactor
 * renames or moves PrismaAccountsRepo, this is the only line to fix
 * (D6 insulation, paired sister: dispatch C2 legacy-*-adapter pattern).
 *
 * R2 documented: the wrapped class lives in another module's infrastructure
 * layer — accepted as transitional until poc-accounting-cleanup.
 */
export class LegacyAccountsAdapter implements AccountsLookupPort {
  private readonly repo: PrismaAccountsRepo;

  constructor(repo: PrismaAccountsRepo = new PrismaAccountsRepo()) {
    this.repo = repo;
  }

  async findManyByIds(orgId: string, ids: string[]): Promise<Account[]> {
    const rows = await this.repo.findManyByIds(orgId, ids);
    return rows.map(toPortAccount);
  }

  async findByType(orgId: string, type: string): Promise<Account[]> {
    const rows = await this.repo.findByType(orgId, type as AccountType);
    return rows.map(toPortAccount);
  }

  async findDetailChildrenByParentCodes(
    orgId: string,
    codes: string[],
  ): Promise<Account[]> {
    const rows = await this.repo.findDetailChildrenByParentCodes(orgId, codes);
    return rows.map(toPortAccount);
  }
}

/**
 * Narrowing map — Prisma Account model → domain Account port type. The
 * Prisma row has the full DB column set; the port surface keeps the
 * 7 fields the agent actually reads.
 */
function toPortAccount(row: PrismaAccount): Account {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    subtype: row.subtype ?? null,
    isDetail: row.isDetail,
    requiresContact: row.requiresContact,
  };
}
