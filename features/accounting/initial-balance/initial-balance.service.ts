import "server-only";
import { NotFoundError } from "@/features/shared/errors";
import { InitialBalanceRepository } from "./initial-balance.repository";
import { buildInitialBalance } from "./initial-balance.builder";
import type { InitialBalanceStatement } from "./initial-balance.types";

/**
 * Service layer for the Balance Inicial report.
 *
 * Orchestrates a parallel fetch from the repository, enforces the
 * "no CA voucher → NotFoundError" business rule (REQ-2), and delegates
 * grouping / invariant computation to the pure builder function.
 *
 * `dateAt` is derived from `MIN(je.date)` of POSTED CA entries — the
 * opening-balance date shown in the report title and legal header.
 */
export class InitialBalanceService {
  constructor(
    private readonly repo = new InitialBalanceRepository(),
  ) {}

  async generate(orgId: string): Promise<InitialBalanceStatement> {
    // Parallel fetch: rows, org metadata, CA count, and CA opening date.
    // All four are independent — fire them together (REQ-1, REQ-2, REQ-3).
    const [rows, orgHeader, caCount, caDate] = await Promise.all([
      this.repo.getInitialBalanceFromCA(orgId),
      this.repo.getOrgMetadata(orgId),
      this.repo.countCAVouchers(orgId),
      this.repo.getCADate(orgId),
    ]);

    // REQ-2: guard — the report requires at least one POSTED CA voucher.
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
      },
      dateAt,
      rows,
      caCount,
    });
  }
}
