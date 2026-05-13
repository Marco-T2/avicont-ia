/**
 * Outbound port for account lookups — narrow surface for domain use cases.
 * Insulates domain/application from PrismaAccountsRepo directly (REQ-004).
 * Domain layer: no server-only, no Prisma runtime, no SDK deps.
 */

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string | null;
  isDetail: boolean;
  requiresContact: boolean;
}

/**
 * AccountsLookupPort — 3-method narrow interface.
 * LegacyAccountsAdapter wraps PrismaAccountsRepo at C2.
 */
export interface AccountsLookupPort {
  findManyByIds(orgId: string, ids: string[]): Promise<Account[]>;
  findByType(orgId: string, type: string): Promise<Account[]>;
  findDetailChildrenByParentCodes(orgId: string, codes: string[]): Promise<Account[]>;
}
