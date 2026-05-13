import type { Prisma } from "@/generated/prisma/client";
import type { AccountType } from "@/generated/prisma/enums";

/**
 * WS-D1: WorksheetMovementAggregation + WorksheetAccountMetadata extracted from
 * features/accounting/worksheet/worksheet.repository.ts (infra file — lines 25-46)
 * to domain/types.ts (domain layer). MANDATORY: WorksheetQueryPort (domain) returns
 * these types from its 3 methods — port interface CANNOT reference infra-defined types.
 *
 * Canonical source post-C0: domain/types.ts. Both PrismaWorksheetRepo AND
 * WorksheetQueryPort import from here. Repo has NO type definitions of its own
 * for these shapes. Cite design §2 WS-D1 + proposal #2315.
 */

/**
 * Aggregation result per account — parallel shape to MovementAggregation from
 * financial-statements, but NOT reused from that module to keep the worksheet
 * module self-contained (per design §2 note on decoupled exporters).
 */
export type WorksheetMovementAggregation = {
  accountId: string;
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  nature: "DEUDORA" | "ACREEDORA";
};

/**
 * Account metadata returned by findAccountsWithDetail — extends AccountMetadata
 * shape from financial-statements.types by adding isDetail and accountType.
 */
export type WorksheetAccountMetadata = {
  id: string;
  code: string;
  name: string;
  level: number;
  type: AccountType;
  nature: "DEUDORA" | "ACREEDORA";
  isActive: boolean;
  isDetail: boolean;
  isContraAccount: boolean;
};
