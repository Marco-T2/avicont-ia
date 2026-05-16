import "server-only";
import Decimal from "decimal.js";
import { BaseRepository } from "@/features/shared/base.repository";
import type { AccountSubtype } from "@/generated/prisma/client";
import { FINALIZED_JE_STATUSES_SQL } from "@/modules/accounting/shared/infrastructure/journal-status.sql";
import type {
  InitialBalanceOrgHeader,
  InitialBalanceRow,
} from "../domain/initial-balance.types";
import type { InitialBalanceQueryPort } from "../domain/initial-balance.ports";

/**
 * Prisma adapter for the Initial Balance hexagonal port.
 *
 * Narrows `InitialBalanceQueryPort` (4 methods — IB-D2) over Prisma/$queryRaw.
 * Class rename: `InitialBalanceRepository` → `PrismaInitialBalanceRepo`
 * (infrastructure naming convention, OLEADA 6 sub-POC 4/8).
 *
 * **IB-D1 (infra-private types)**: `RawInitialBalanceRow` and `RawCACountRow`
 * are NOT extracted to domain — they are purely infra-private raw DB row shapes
 * that never cross the port boundary. Domain imports come directly from
 * `../domain/initial-balance.types`.
 *
 * **Shared-dep carry**: `BaseRepository` from `@/features/shared/base.repository`
 * is a shared infrastructure class (NOT under features/accounting/initial-balance/)
 * and is NOT deleted at C5. Accepted carry per design §10.
 *
 * Sister precedent: modules/accounting/worksheet/infrastructure/prisma-worksheet.repo.ts
 */

/**
 * Raw row shape returned by the CA signed-net aggregation query. All numeric
 * columns are emitted as text to preserve precision, then re-hydrated into
 * `Prisma.Decimal` in the mapper (mirrors `getAperturaPatrimonyDelta` in
 * `equity-statement.repository.ts`).
 */
type RawInitialBalanceRow = {
  account_id: string;
  code: string;
  name: string;
  subtype: AccountSubtype;
  amount: string;
};

type RawCACountRow = {
  count: string;
};

export class PrismaInitialBalanceRepo
  extends BaseRepository
  implements InitialBalanceQueryPort
{
  /**
   * Returns signed-net lines from the MOST-RECENT **finalized** (POSTED or
   * LOCKED, per FIN-1) CA (Comprobante de Apertura) voucher of the
   * organization.
   *
   * **BREAKING SEMANTIC CHANGE (Phase 6.4 — spec REQ-6.0 + design rev 2 §9)**:
   * Prior to this change, the method aggregated `SUM(debit−credit)` across
   * EVERY POSTED CA for the org. That behavior caused multi-year corruption
   * when multiple CAs existed (the annual-close C-3 root cause: a fresh CA
   * minted for year N+1 would compound into year N's initial-balance report).
   *
   * Post-narrowing: only lines belonging to the CA with the latest
   * `je.date` are aggregated (via `je.id = (SELECT … ORDER BY je.date DESC,
   * je."createdAt" DESC LIMIT 1)` subquery). Result: most-recent CA only.
   *
   * Year-scoped callers (annual-close per-year reports) MUST use
   * `getInitialBalanceFromCAForYear(orgId, year)` — that method filters by
   * year window without falling back to most-recent semantics.
   *
   * Sign convention (identical to balance-sheet / EEPN v2):
   *   DEUDORA   accounts (Activo):  amount = debit − credit
   *   ACREEDORA accounts (Pasivo/Patrimonio): amount = credit − debit
   *
   * Accounts without a `subtype` (root nodes) are excluded — the Initial
   * Balance report only renders detail/leaf accounts with a defined subtype.
   */
  async getInitialBalanceFromCA(orgId: string): Promise<InitialBalanceRow[]> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawInitialBalanceRow[]>`
      SELECT
        jl."accountId" AS account_id,
        a.code         AS code,
        a.name         AS name,
        a.subtype      AS subtype,
        SUM(
          CASE
            WHEN a.nature = 'DEUDORA'   THEN jl.debit - jl.credit
            WHEN a.nature = 'ACREEDORA' THEN jl.credit - jl.debit
          END
        )::text AS amount
      FROM journal_lines   jl
      JOIN journal_entries je ON je.id  = jl."journalEntryId"
      JOIN accounts        a  ON a.id   = jl."accountId"
      WHERE
        je."organizationId" = ${orgId}
        AND je."status"     ${FINALIZED_JE_STATUSES_SQL}
        AND a.subtype IS NOT NULL
        AND je.id = (
          SELECT je2.id
          FROM journal_entries je2
          JOIN voucher_types   vt2 ON vt2.id = je2."voucherTypeId"
          WHERE je2."organizationId" = ${orgId}
            AND je2."status"         ${FINALIZED_JE_STATUSES_SQL}
            AND vt2.code             = 'CA'
          ORDER BY je2.date DESC, je2."createdAt" DESC
          LIMIT 1
        )
      GROUP BY jl."accountId", a.code, a.name, a.subtype
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      code: r.code,
      name: r.name,
      subtype: r.subtype,
      amount: new Decimal(r.amount),
    }));
  }

  /**
   * Counts the number of **finalized** (POSTED or LOCKED, per FIN-1) CA
   * vouchers (JournalEntry rows with voucher code='CA') for the organization.
   * DRAFT and VOIDED entries are excluded; other orgs' CAs never appear thanks
   * to the explicit `je."organizationId" = ${orgId}` filter.
   *
   * Used by the service layer to emit the `multipleCA` warning flag when the
   * organization has more than one opening-balance voucher.
   */
  async countCAVouchers(orgId: string): Promise<number> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawCACountRow[]>`
      SELECT COUNT(DISTINCT je.id)::text AS count
      FROM journal_entries je
      JOIN voucher_types   vt ON vt.id = je."voucherTypeId"
      WHERE
        je."organizationId" = ${orgId}
        AND je."status"     ${FINALIZED_JE_STATUSES_SQL}
        AND vt.code         = 'CA'
    `;

    if (rows.length === 0) return 0;
    return Number.parseInt(rows[0].count, 10);
  }

  /**
   * Year-scoped count of **finalized** (POSTED or LOCKED, per FIN-1) CA
   * vouchers (NEW per spec REQ-6.1).
   *
   * Filters CA `JournalEntry` rows whose `date` falls within
   * `[${year}-01-01, ${year}-12-31]` (inclusive — noon-UTC anchored, see
   * `lib/date-utils.ts:toNoonUtc`). Typically returns 0 or 1 — multiple CAs
   * in the same year indicate manual reconciliation drift.
   *
   * Annual-close consumes this in Phase 8 acceptance tests + future
   * per-year `InitialBalanceService.generateForYear` flow.
   */
  async countCAVouchersForYear(orgId: string, year: number): Promise<number> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawCACountRow[]>`
      SELECT COUNT(DISTINCT je.id)::text AS count
      FROM journal_entries je
      JOIN voucher_types   vt ON vt.id = je."voucherTypeId"
      WHERE
        je."organizationId" = ${orgId}
        AND je."status"     ${FINALIZED_JE_STATUSES_SQL}
        AND vt.code         = 'CA'
        AND je.date        >= ${new Date(`${year}-01-01T00:00:00Z`)}
        AND je.date        <= ${new Date(`${year}-12-31T23:59:59.999Z`)}
    `;

    if (rows.length === 0) return 0;
    return Number.parseInt(rows[0].count, 10);
  }

  /**
   * Year-scoped variant of `getInitialBalanceFromCA` (NEW per spec REQ-6.0).
   *
   * Filters the CA aggregation to vouchers dated within
   * `[${year}-01-01, ${year}-12-31]`. Returns lines from THAT year's CA(s)
   * only — does NOT include prior or future CAs (this is the fix for the
   * annual-close C-3 multi-year corruption root cause).
   *
   * If a year has multiple CAs (manual drift), all matching CAs aggregate.
   * `getInitialBalanceFromCAForYear` does NOT silently narrow to most-recent
   * — that's the LEGACY method's post-6.4 semantic. Callers that need the
   * most-recent CA within a year MUST use `getInitialBalanceFromCA` after
   * the legacy narrowing in Phase 6.4.
   */
  async getInitialBalanceFromCAForYear(
    orgId: string,
    year: number,
  ): Promise<InitialBalanceRow[]> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawInitialBalanceRow[]>`
      SELECT
        jl."accountId" AS account_id,
        a.code         AS code,
        a.name         AS name,
        a.subtype      AS subtype,
        SUM(
          CASE
            WHEN a.nature = 'DEUDORA'   THEN jl.debit - jl.credit
            WHEN a.nature = 'ACREEDORA' THEN jl.credit - jl.debit
          END
        )::text AS amount
      FROM journal_lines   jl
      JOIN journal_entries je ON je.id  = jl."journalEntryId"
      JOIN accounts        a  ON a.id   = jl."accountId"
      JOIN voucher_types   vt ON vt.id  = je."voucherTypeId"
      WHERE
        je."organizationId" = ${orgId}
        AND je."status"     ${FINALIZED_JE_STATUSES_SQL}
        AND vt.code         = 'CA'
        AND a.subtype IS NOT NULL
        AND je.date        >= ${new Date(`${year}-01-01T00:00:00Z`)}
        AND je.date        <= ${new Date(`${year}-12-31T23:59:59.999Z`)}
      GROUP BY jl."accountId", a.code, a.name, a.subtype
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      code: r.code,
      name: r.name,
      subtype: r.subtype,
      amount: new Decimal(r.amount),
    }));
  }

  /**
   * Fetches organization header metadata for the exporter banners. Pulls from
   * `OrgProfile` (razón social, NIT, representante legal, dirección).
   *
   * Returns `null` when the organization does not exist.
   */
  async getOrgMetadata(orgId: string): Promise<InitialBalanceOrgHeader | null> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        profile: {
          select: {
            razonSocial: true,
            nit: true,
            representanteLegal: true,
            direccion: true,
            ciudad: true,
          },
        },
      },
    });
    if (!org) return null;

    return {
      razonSocial: org.profile?.razonSocial ?? "",
      nit: org.profile?.nit ?? "",
      representanteLegal: org.profile?.representanteLegal ?? "",
      direccion: org.profile?.direccion ?? "",
      ciudad: org.profile?.ciudad ?? "",
    };
  }

  /**
   * Returns the earliest date among all **finalized** (POSTED or LOCKED, per
   * FIN-1) CA voucher journal entries for the organization (`MIN(je.date)`).
   * This is the opening-balance date shown in the report title and used as
   * `dateAt` in the statement.
   *
   * Returns `null` when no finalized CA entries exist (same guard as
   * `countCAVouchers === 0`).
   */
  async getCADate(orgId: string): Promise<Date | null> {
    this.requireOrg(orgId);

    type RawDateRow = { date_at: Date | null };

    const rows = await this.db.$queryRaw<RawDateRow[]>`
      SELECT MIN(je.date) AS date_at
      FROM journal_entries je
      JOIN voucher_types   vt ON vt.id = je."voucherTypeId"
      WHERE
        je."organizationId" = ${orgId}
        AND je."status"     ${FINALIZED_JE_STATUSES_SQL}
        AND vt.code         = 'CA'
    `;

    return rows[0]?.date_at ?? null;
  }

  /**
   * Year-scoped variant of `getCADate` (NEW per spec REQ-6.1).
   *
   * Returns `MIN(je.date)` among **finalized** (POSTED or LOCKED, per FIN-1)
   * CA entries dated within `[${year}-01-01, ${year}-12-31]`. Returns `null`
   * if no finalized CA in that year.
   */
  async getCADateForYear(orgId: string, year: number): Promise<Date | null> {
    this.requireOrg(orgId);

    type RawDateRow = { date_at: Date | null };

    const rows = await this.db.$queryRaw<RawDateRow[]>`
      SELECT MIN(je.date) AS date_at
      FROM journal_entries je
      JOIN voucher_types   vt ON vt.id = je."voucherTypeId"
      WHERE
        je."organizationId" = ${orgId}
        AND je."status"     ${FINALIZED_JE_STATUSES_SQL}
        AND vt.code         = 'CA'
        AND je.date        >= ${new Date(`${year}-01-01T00:00:00Z`)}
        AND je.date        <= ${new Date(`${year}-12-31T23:59:59.999Z`)}
    `;

    return rows[0]?.date_at ?? null;
  }
}
