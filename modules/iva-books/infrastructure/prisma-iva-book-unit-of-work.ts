import "server-only";

import { withAuditTx } from "@/features/shared/audit-tx";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import { PrismaFiscalPeriodsTxRepo } from "@/modules/shared/infrastructure/prisma-fiscal-periods-tx.repo";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import type {
  IvaBookScope,
  IvaBookUnitOfWork,
} from "../application/iva-book-unit-of-work";
import { PrismaIvaPurchaseBookEntryRepo } from "./prisma-iva-purchase-book-entry.repo";
import { PrismaIvaSalesBookEntryRepo } from "./prisma-iva-sales-book-entry.repo";

/**
 * Postgres-backed adapter for `IvaBookUnitOfWork` (POC #11.0c A3 Ciclo 6).
 * Mirror simplificado precedent purchase C6 `PrismaPurchaseUnitOfWork`
 * (commit `5b61594`) salvo asimetrías declaradas:
 *   - 3 superficies tx-bound (vs 7 en purchase): `ivaSalesBooks` +
 *     `ivaPurchaseBooks` + `fiscalPeriods` (BaseScope).
 *   - 0 cross-module deps en constructor (lock C textual
 *     `iva-book-unit-of-work.ts:21-27`): IVA NO escribe journals ni
 *     balances directamente — bridge cross-module va por
 *     `Sale/PurchaseJournalRegenNotifierPort` (D-1 lockeada). Constructor
 *     recibe solo `repo: UnitOfWorkRepoLike`.
 *
 * Lock B confirmado (`iva-book-unit-of-work.ts:11-19`): single UoW con 2
 * repos sale + purchase (NO split por aggregate) — `applyVoidCascade` legacy
 * toca ambas tablas en un solo flujo, split forzaría `UoW.run()` anidados
 * con semántica Postgres ambigua.
 *
 * Delegates a `withAuditTx` — las 4 invariantes (correlationId pre-tx,
 * SET LOCAL inside tx, fn invoke, return shape) son inherited unchanged.
 * Solo cambia el shape del scope: 2 superficies tx-bound + fiscalPeriods
 * (BaseScope) + correlationId.
 *
 * NO §17 carve-out cite — todos los imports son del propio módulo
 * iva-books (los 2 repos C2/C3) o del shared base (PrismaFiscalPeriodsTxRepo
 * cubierto por R3 vigente, port en `shared/domain/`). §17 aplica solo a
 * cross-module concrete imports — ver catálogo POC #11.0b A3
 * `cross-module-imports-catalog` para asimetría con purchase UoW (5
 * carve-outs cited) y sale UoW.
 *
 * Lock F-α (`iva-book-unit-of-work.ts:29-37`) afecta `applyVoidCascade` —
 * NO entra acá: la cascade entry point recibe `scope: IvaBookScope`
 * directamente del caller (legacy `voidCascadeTx` chain), NO via
 * `uow.run()`. Este adapter solo cubre regenerate / recompute / void /
 * reactivate (5 use cases que sí usan `uow.run()`).
 */
export class PrismaIvaBookUnitOfWork implements IvaBookUnitOfWork {
  constructor(private readonly repo: UnitOfWorkRepoLike) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: IvaBookScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    return withAuditTx(this.repo, ctx, async (tx, correlationId) => {
      const scope: IvaBookScope = {
        correlationId,
        fiscalPeriods: new PrismaFiscalPeriodsTxRepo(tx),
        ivaSalesBooks: new PrismaIvaSalesBookEntryRepo(tx),
        ivaPurchaseBooks: new PrismaIvaPurchaseBookEntryRepo(tx),
      };
      return fn(scope);
    });
  }
}
