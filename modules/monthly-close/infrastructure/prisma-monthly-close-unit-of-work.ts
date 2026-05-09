import "server-only";

import { withAuditTx } from "@/features/shared/audit-tx";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import { PrismaFiscalPeriodsTxRepo } from "@/modules/shared/infrastructure/prisma-fiscal-periods-tx.repo";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import type {
  MonthlyCloseScope,
  MonthlyCloseUnitOfWork,
} from "../application/monthly-close-unit-of-work";
import { PrismaAccountingReaderAdapter } from "./prisma-accounting-reader.adapter";
import { PrismaPeriodLockingWriterAdapter } from "./prisma-period-locking-writer.adapter";

/**
 * Postgres-backed adapter for `MonthlyCloseUnitOfWork` (POC nuevo monthly-close
 * C3). Mirror sale/accounting/iva-books precedent EXACT cumulative 3 evidencias —
 * delegates fully a `withAuditTx` 4 invariantes (correlationId pre-tx, SET
 * LOCAL inside, fn invoke, return shape) inherited unchanged. Solo cambia el
 * shape del scope: 2 superficies tx-bound (`accounting` + `locking`) +
 * `fiscalPeriods` (BaseScope shared cumulative POC #9) + `correlationId`.
 *
 * **Timeout 30_000 wiring legacy parity preservation** (Lock #5 NEW 1ra
 * evidencia POC monthly-close): `withAuditTx(repo, ctx, fn, {timeout: 30_000})`
 * 4to arg signature `audit-tx.ts:32` consume options. Sale + accounting +
 * iva-books NO usan options 4to arg (default no-timeout, Prisma default 5s).
 * Monthly-close 1ra evidencia POC consume legacy parity preservation
 * `features/monthly-close/monthly-close.service.ts:228` `repo.transaction(cb,
 * {timeout: 30_000})` — close use case workload (5 lock cascade + balance gate
 * + raw SQL JOIN) excede default 5s, 30s margin operacional adapter constants
 * (NO config dinámico).
 *
 * §17 carve-out: UoW construye adapters tx-bound dentro `withAuditTx` —
 * `Prisma.TransactionClient` no existe pre-tx, un singleton en composition
 * root no puede capturar `tx` per-run. Cross-module concrete imports cubiertos:
 * `shared/PrismaFiscalPeriodsTxRepo` (R3 vigente — port en `shared/domain/`).
 * Los 2 adapters mismo módulo `monthly-close/infrastructure`
 * (`PrismaAccountingReaderAdapter` + `PrismaPeriodLockingWriterAdapter`)
 * encapsulan el cross-MODULE Prisma access (accounting tables + 5 entity tables
 * sale/purchase/payment/dispatch/journalEntry) — adapters mismo módulo via §17
 * scope-membership consume `tx` per-run within callback boundary.
 * `DraftDocumentsReader` adapter NO entra scope (pre-TX outside-scope read-only)
 * — composition root C4 instancia con `db: PrismaClient` directo.
 *
 * **Riesgo C lock cascade rationale citation** (Lock #6 NEW 1ra evidencia POC
 * monthly-close paired adapter + UoW pattern): STRICT ORDER 5 lock cascade
 * `lockDispatches → lockPayments → lockJournalEntries → lockSales →
 * lockPurchases` preserved at service-level (port NO impone orden,
 * `monthly-close.service.ts:124-129`). Rationale FK direction Sale↔JE archive
 * `openspec/changes/archive/2026-04-21-cierre-periodo/design.md` §"Lock order"
 * — frozen logic pre-hex POC nuevo monthly-close.
 */
export class PrismaMonthlyCloseUnitOfWork implements MonthlyCloseUnitOfWork {
  constructor(private readonly repo: UnitOfWorkRepoLike) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: MonthlyCloseScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    return withAuditTx(
      this.repo,
      ctx,
      async (tx, correlationId) => {
        const scope: MonthlyCloseScope = {
          correlationId,
          fiscalPeriods: new PrismaFiscalPeriodsTxRepo(tx),
          accounting: new PrismaAccountingReaderAdapter(tx),
          locking: new PrismaPeriodLockingWriterAdapter(tx),
        };
        return fn(scope);
      },
      { timeout: 30_000 },
    );
  }
}
