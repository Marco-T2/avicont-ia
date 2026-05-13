import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type {
  EquityAccountMetadata,
  PatrimonyVoucherCode,
  TypedPatrimonyMovements,
} from "../domain/equity-statement.types";
import type { EquityStatementQueryPort } from "../domain/ports/equity-statement-query.port";
import type { EquityOrgMetadata } from "../domain/ports/equity-statement-query.port";

const PATRIMONY_VOUCHER_CODES: readonly PatrimonyVoucherCode[] = ["CP", "CL", "CV"] as const;

type RawTypedMovementRow = {
  voucher_code: PatrimonyVoucherCode;
  account_id: string;
  total_debit: string;
  total_credit: string;
  nature: "DEUDORA" | "ACREEDORA";
};

type RawBalanceRow = {
  account_id: string;
  total_debit: string;
  total_credit: string;
  nature: "DEUDORA" | "ACREEDORA";
};

type RawAperturaDeltaRow = {
  account_id: string;
  net: string;
};

export class PrismaEquityStatementRepo
  extends BaseRepository
  implements EquityStatementQueryPort
{
  /**
   * Aggregates POSTED JournalLines up to (cutoff) and returns signed-net balance
   * per accountId for accounts with type=PATRIMONIO.
   *
   * Sign convention (same as balance-sheet):
   *   DEUDORA:   balance = debit − credit
   *   ACREEDORA: balance = credit − debit
   *
   * Returns Map<accountId, Decimal>. Zero balances are omitted.
   */
  async getPatrimonioBalancesAt(
    orgId: string,
    cutoff: Date,
  ): Promise<Map<string, Prisma.Decimal>> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawBalanceRow[]>`
      SELECT
        jl."accountId"  AS account_id,
        SUM(jl.debit)   AS total_debit,
        SUM(jl.credit)  AS total_credit,
        a.nature
      FROM journal_lines   jl
      JOIN journal_entries je ON je.id  = jl."journalEntryId"
      JOIN accounts        a  ON a.id   = jl."accountId"
      WHERE
        je."organizationId" = ${orgId}
        AND je.status       = 'POSTED'
        AND je.date        <= ${cutoff}
        AND a.type          = 'PATRIMONIO'
      GROUP BY jl."accountId", a.nature
    `;

    const map = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      const debit  = new Prisma.Decimal(r.total_debit);
      const credit = new Prisma.Decimal(r.total_credit);
      const signed =
        r.nature === "DEUDORA" ? debit.minus(credit) : credit.minus(debit);
      if (!signed.isZero()) map.set(r.account_id, signed);
    }
    return map;
  }

  /**
   * Aggregates POSTED JournalLines in [dateFrom, dateTo] filtered by
   * voucherType.code IN ('CP','CL','CV') and account.type='PATRIMONIO'.
   *
   * Sign convention mirrors getPatrimonioBalancesAt:
   *   DEUDORA:   delta = debit − credit
   *   ACREEDORA: delta = credit − debit
   *
   * Returns a nested Map keyed by PatrimonyVoucherCode; empty buckets and zero
   * deltas are omitted.
   */
  async getTypedPatrimonyMovements(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<TypedPatrimonyMovements> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawTypedMovementRow[]>`
      SELECT
        vt.code         AS voucher_code,
        jl."accountId"  AS account_id,
        SUM(jl.debit)   AS total_debit,
        SUM(jl.credit)  AS total_credit,
        a.nature
      FROM journal_lines   jl
      JOIN journal_entries je ON je.id  = jl."journalEntryId"
      JOIN accounts        a  ON a.id   = jl."accountId"
      JOIN voucher_types   vt ON vt.id  = je."voucherTypeId"
      WHERE
        je."organizationId" = ${orgId}
        AND je.status       = 'POSTED'
        AND je.date        >= ${dateFrom}
        AND je.date        <= ${dateTo}
        AND a.type          = 'PATRIMONIO'
        AND vt.code IN ('CP', 'CL', 'CV')
      GROUP BY vt.code, jl."accountId", a.nature
    `;

    const out: TypedPatrimonyMovements = new Map();
    for (const r of rows) {
      const debit = new Prisma.Decimal(r.total_debit);
      const credit = new Prisma.Decimal(r.total_credit);
      const signed =
        r.nature === "DEUDORA" ? debit.minus(credit) : credit.minus(debit);
      if (signed.isZero()) continue;
      if (!PATRIMONY_VOUCHER_CODES.includes(r.voucher_code)) continue;

      let bucket = out.get(r.voucher_code);
      if (!bucket) {
        bucket = new Map();
        out.set(r.voucher_code, bucket);
      }
      bucket.set(r.account_id, signed);
    }
    return out;
  }

  /**
   * Aggregates POSTED JournalLines in [dateFrom, dateTo] joined to VoucherTypeCfg
   * on code='CA' and account.type='PATRIMONIO'. Returns signed-net balance per
   * accountId. Zero-deltas are omitted.
   */
  async getAperturaPatrimonyDelta(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Map<string, Prisma.Decimal>> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawAperturaDeltaRow[]>`
      SELECT
        jl."accountId" AS account_id,
        SUM(
          CASE
            WHEN a.nature = 'DEUDORA'   THEN jl.debit - jl.credit
            WHEN a.nature = 'ACREEDORA' THEN jl.credit - jl.debit
          END
        )::text AS net
      FROM journal_lines   jl
      JOIN journal_entries je ON je.id  = jl."journalEntryId"
      JOIN accounts        a  ON a.id   = jl."accountId"
      JOIN voucher_types   vt ON vt.id  = je."voucherTypeId"
      WHERE
        je."organizationId" = ${orgId}
        AND je.status       = 'POSTED'
        AND je.date        >= ${dateFrom}
        AND je.date        <= ${dateTo}
        AND vt.code         = 'CA'
        AND a.type          = 'PATRIMONIO'
      GROUP BY jl."accountId"
      HAVING SUM(
               CASE
                 WHEN a.nature = 'DEUDORA'   THEN jl.debit - jl.credit
                 WHEN a.nature = 'ACREEDORA' THEN jl.credit - jl.debit
               END
             ) <> 0
    `;

    const map = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      map.set(r.account_id, new Prisma.Decimal(r.net));
    }
    return map;
  }

  /** Active PATRIMONIO accounts ordered by code. */
  async findPatrimonioAccounts(orgId: string): Promise<EquityAccountMetadata[]> {
    const scope = this.requireOrg(orgId);
    const accounts = await this.db.account.findMany({
      where: { ...scope, isActive: true, type: "PATRIMONIO" },
      select: { id: true, code: true, name: true, nature: true },
      orderBy: { code: "asc" },
    });
    return accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      nature: a.nature as "DEUDORA" | "ACREEDORA",
    }));
  }

  /** Org metadata for export headers. */
  async getOrgMetadata(orgId: string): Promise<EquityOrgMetadata | null> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    if (!org) return null;
    return { name: org.name, taxId: null, address: null };
  }

  /**
   * Returns true when the range [dateFrom, dateTo] matches exactly a CLOSED FiscalPeriod.
   * preliminary = !isClosedPeriodMatch(...)
   */
  async isClosedPeriodMatch(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<boolean> {
    const scope = this.requireOrg(orgId);
    const period = await this.db.fiscalPeriod.findFirst({
      where: { ...scope, status: "CLOSED", startDate: dateFrom, endDate: dateTo },
      select: { id: true },
    });
    return period !== null;
  }
}
