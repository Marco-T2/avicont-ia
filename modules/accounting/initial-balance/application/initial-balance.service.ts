import { NotFoundError } from "@/features/shared/errors";
import type { InitialBalanceQueryPort } from "../domain/initial-balance.ports";
import { buildInitialBalance } from "../domain/initial-balance.builder";
import type { InitialBalanceStatement } from "../domain/initial-balance.types";

// ── Deps ──────────────────────────────────────────────────────────────────────

/**
 * Dependency injection contract for InitialBalanceService.
 *
 * Single-port architecture (IB-D3): only InitialBalanceQueryPort (4 methods).
 * No secondary port — initial-balance is self-contained.
 * Per design §4 IB-D4: deps-object replaces positional-default ctor.
 */
interface InitialBalanceServiceDeps {
  queryPort: InitialBalanceQueryPort;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * InitialBalanceService — orchestrates the Balance Inicial report.
 *
 * Deps-object ctor per IB-D4 (positional-default → port-typed deps-object).
 * NO server-only directive — application layer is pure orchestration.
 * Server-only boundary lives in presentation/server.ts (REQ-002).
 *
 * Does NOT import Prisma directly. All DB access goes through InitialBalanceQueryPort.
 * Method name `generate` preserved from features/ original — NOT renamed.
 * Axis-distinct from WorksheetService (generate vs generateWorksheet).
 *
 * Shared-dep carry: NotFoundError from features/shared/errors (not deleted at C5 —
 * shared infra under features/shared/, NOT under features/accounting/initial-balance/).
 */
export class InitialBalanceService {
  private readonly queryPort: InitialBalanceQueryPort;

  constructor({ queryPort }: InitialBalanceServiceDeps) {
    this.queryPort = queryPort;
  }

  /**
   * Generate a Balance Inicial (Initial Balance) report.
   *
   * - Parallel fetch: rows, org metadata, CA count, and CA opening date
   *   via Promise.all — all 4 port methods fired concurrently (IB-D2 4-method port).
   * - Business rule: requires at least one POSTED CA voucher (caCount > 0).
   * - Fallback: if caDate null despite caCount > 0, uses epoch.
   * - Pure builder: no DB access after the 4-parallel fetch.
   *
   * **Year-scoped variant (Phase 6.5 — spec REQ-6.0 + REQ-6.1)**: pass an
   * optional `year` to scope the report to a single fiscal year's CA
   * (annual-close per-year flow). When omitted, falls back to the LEGACY
   * most-recent-CA semantics (post-Phase-6.4 narrowing).
   *
   * - With \`year\`: uses \`getInitialBalanceFromCAForYear\`,
   *   \`countCAVouchersForYear\`, \`getCADateForYear\` — strict year window.
   * - Without \`year\`: uses \`getInitialBalanceFromCA\` (now most-recent
   *   only — Phase 6.4 narrowing), \`countCAVouchers\` (all-time count
   *   driving the \`multipleCA\` warning flag), \`getCADate\` (earliest CA
   *   date as legacy report uses).
   *
   * The \`caCount\` returned to the builder reflects the queried scope:
   * year-scoped count when \`year\` provided, all-time count otherwise.
   * The all-time count is what surfaces the \`multipleCA > 1\` UX warning;
   * a year-scoped count of 0 or 1 is the expected steady state.
   */
  async generate(
    orgId: string,
    year?: number,
  ): Promise<InitialBalanceStatement> {
    const rowsP =
      year !== undefined
        ? this.queryPort.getInitialBalanceFromCAForYear(orgId, year)
        : this.queryPort.getInitialBalanceFromCA(orgId);
    const orgHeaderP = this.queryPort.getOrgMetadata(orgId);
    const caCountP =
      year !== undefined
        ? this.queryPort.countCAVouchersForYear(orgId, year)
        : this.queryPort.countCAVouchers(orgId);
    const caDateP =
      year !== undefined
        ? this.queryPort.getCADateForYear(orgId, year)
        : this.queryPort.getCADate(orgId);

    const [rows, orgHeader, caCount, caDate] = await Promise.all([
      rowsP,
      orgHeaderP,
      caCountP,
      caDateP,
    ]);

    // Business rule: the report requires at least one POSTED CA voucher.
    if (caCount === 0) {
      throw new NotFoundError(
        "Comprobante de Apertura (CA). Registre un asiento de apertura antes de generar el Balance Inicial",
        "CA_NOT_FOUND",
      );
    }

    // Fallback: if caDate is unexpectedly null despite caCount > 0, use epoch.
    const dateAt = caDate ?? new Date(0);

    return buildInitialBalance({
      orgId,
      org: orgHeader ?? {
        razonSocial: "",
        nit: "",
        representanteLegal: "",
        direccion: "",
        ciudad: "",
      },
      dateAt,
      rows,
      caCount,
    });
  }
}
