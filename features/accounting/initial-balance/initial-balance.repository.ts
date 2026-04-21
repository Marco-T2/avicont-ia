import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type { AccountSubtype } from "@/generated/prisma/client";
import type {
  InitialBalanceOrgHeader,
  InitialBalanceRow,
} from "./initial-balance.types";

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

export class InitialBalanceRepository extends BaseRepository {
  /**
   * Aggregates POSTED JournalLines across every CA (Comprobante de Apertura)
   * voucher of the organization and returns one signed-net row per account.
   *
   * Sign convention (identical to balance-sheet / EEPN v2):
   *   DEUDORA   accounts (Activo):  amount = debit − credit
   *   ACREEDORA accounts (Pasivo/Patrimonio): amount = credit − debit
   *
   * Accounts without a `subtype` (root nodes) are excluded — the Initial
   * Balance report only renders detail/leaf accounts with a defined subtype.
   *
   * Mirrors `EquityStatementRepository.getAperturaPatrimonyDelta` but keeps
   * every AccountType (not just PATRIMONIO) and returns the account catalog
   * columns (code, name, subtype) inline so the builder can group without a
   * second query.
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
      JOIN voucher_types   vt ON vt.id  = je."voucherTypeId"
      WHERE
        je."organizationId" = ${orgId}
        AND je."status"     = 'POSTED'
        AND vt.code         = 'CA'
        AND a.subtype IS NOT NULL
      GROUP BY jl."accountId", a.code, a.name, a.subtype
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      code: r.code,
      name: r.name,
      subtype: r.subtype,
      amount: new Prisma.Decimal(r.amount),
    }));
  }

  /**
   * Counts the number of POSTED CA vouchers (JournalEntry rows with voucher
   * code='CA' and status='POSTED') for the organization. DRAFT entries are
   * excluded; other orgs' CAs never appear thanks to the explicit
   * `je."organizationId" = ${orgId}` filter.
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
        AND je."status"     = 'POSTED'
        AND vt.code         = 'CA'
    `;

    if (rows.length === 0) return 0;
    return Number.parseInt(rows[0].count, 10);
  }

  /**
   * Fetches organization header metadata for the exporter banners. Pulls from
   * `OrgProfile` (razón social, NIT, dirección). The schema does not yet
   * expose a `representanteLegal` column, so the repo returns an empty string
   * — same graceful-degradation pattern used by
   * `TrialBalanceRepository.getOrgMetadata` for taxId/address.
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
            direccion: true,
          },
        },
      },
    });
    if (!org) return null;

    return {
      razonSocial: org.profile?.razonSocial ?? "",
      nit: org.profile?.nit ?? "",
      representanteLegal: "",
      direccion: org.profile?.direccion ?? "",
    };
  }
}
