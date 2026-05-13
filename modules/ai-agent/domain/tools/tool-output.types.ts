/**
 * Pure output types for tool executors in the application layer.
 * Domain layer: no server-only, no Prisma, no SDK deps.
 */

export interface FindAccountsResultItem {
  id: string;
  code: string;
  name: string;
  requiresContact?: boolean;
}

export type FindAccountsResult = FindAccountsResultItem[];

export interface FindContactResultItem {
  id: string;
  name: string;
  nit: string | null;
}

export type FindContactResult = FindContactResultItem[];
