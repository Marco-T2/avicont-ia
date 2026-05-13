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
   */
  async generate(orgId: string): Promise<InitialBalanceStatement> {
    // Parallel fetch: rows, org metadata, CA count, and CA opening date.
    // All four are independent — fire them together (IB-D2 4-method port).
    const [rows, orgHeader, caCount, caDate] = await Promise.all([
      this.queryPort.getInitialBalanceFromCA(orgId),
      this.queryPort.getOrgMetadata(orgId),
      this.queryPort.countCAVouchers(orgId),
      this.queryPort.getCADate(orgId),
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
