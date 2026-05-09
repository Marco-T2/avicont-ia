import "server-only";

import { prisma } from "@/lib/prisma";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import { MonthlyCloseService } from "../application/monthly-close.service";
import { FiscalPeriodReaderAdapter } from "../infrastructure/fiscal-period-reader.adapter";
import { PrismaDraftDocumentsReaderAdapter } from "../infrastructure/prisma-draft-documents-reader.adapter";
import { PrismaMonthlyCloseUnitOfWork } from "../infrastructure/prisma-monthly-close-unit-of-work";

/**
 * Composition root for the monthly-close module (POC nuevo monthly-close C4) —
 * single point of wiring concrete adapters to `MonthlyCloseService`. Mirror
 * iva-books composition-root precedent EXACT pattern más cercano applicable:
 * own-module infrastructure imports + cross-module reuse via presentation→
 * presentation factory shape (`makeFiscalPeriodsService()` default-init wrap
 * dentro `FiscalPeriodReaderAdapter` constructor cementado C3).
 *
 * **R4 carve-out** (architecture.md): único archivo bajo `presentation/`
 * autorizado a importar de `infrastructure/`. ESLint glob
 * `eslint.config.mjs:152` `modules/<m>/presentation/composition-root.ts`
 * cubre este archivo automáticamente sin modificación. **5ta evidencia matures
 * cumulative cross-module** R4 carve-out cite composition-root JSDoc (sale +
 * payment + iva-books + accounting + monthly-close NEW; fiscal-periods opt-out
 * factory tiny).
 *
 * **NO §17 carve-out cite** — TODOS los imports infrastructure son del propio
 * módulo monthly-close (FiscalPeriodReaderAdapter + PrismaDraftDocumentsReaderAdapter
 * + PrismaMonthlyCloseUnitOfWork — los 3 adapters propios módulo encapsulan
 * cross-module Prisma access + cross-module factory wrap). Cross-module reuse
 * va por presentation→presentation factory `makeFiscalPeriodsService()`
 * (factory-wrap dentro `FiscalPeriodReaderAdapter` default-init). §17 aplica
 * solo a cross-module concrete imports y este composition root no tiene
 * ninguno (mirror iva-books precedent EXACT — **6ta evidencia matures absoluto**
 * cumulative cross-module: sale + payment + iva-books + accounting +
 * fiscal-periods NO §17 cite + monthly-close NEW).
 *
 * **Factory zero-arg** `makeMonthlyCloseService(): MonthlyCloseService`
 * cumulative-precedent EXACT 5 evidencias supersede absoluto (`makeSaleService`
 * + `makePaymentsService` + `makeFiscalPeriodsService` + `makeIvaBookService`
 * + `makeJournalsService` todos zero-arg). **6ta evidencia matures cumulative
 * EXACT supersede absoluto** monthly-close NEW. Bookmark C3-closed wording
 * "(prisma)" param loose superseded por evidence-supersedes-assumption-lock
 * 5ta evidencia matures cumulative cross-POC — internamente factory consume
 * `prisma` module-level via `import { prisma } from "@/lib/prisma"`
 * convención #4 (3 evidencias EXACT sale + iva-books + accounting).
 *
 * **NO memoización** mirror sale + payment + fiscal-periods + accounting 4
 * evidencias supersede — solo iva-books memoiza por cycle-break IVA<>Sale/
 * Purchase rompido por factory shape lazy callback. Monthly-close NO tiene
 * cycle (consume fiscal-periods uni-direction via factory wrap dentro
 * `FiscalPeriodReaderAdapter`); single-instance per-call adecuado pattern
 * canónico mayoría cumulative.
 *
 * `repoLike` pattern paridad sale/iva-books/accounting **3 evidencias EXACT
 * cumulative** — thin wrapper sobre `prisma.$transaction` que
 * `PrismaMonthlyCloseUnitOfWork` consume vía `withAuditTx` (las 4 invariantes
 * correlationId pre-tx, SET LOCAL inside, fn invoke, return shape inherited
 * unchanged) + 4to arg `{timeout: 30_000}` legacy parity preservation cementado
 * C3 GREEN dentro `PrismaMonthlyCloseUnitOfWork.run` callback.
 *
 * **Wiring 3 deps directos** (composition root toca 3 adapters explicit; otros
 * 3 — Accounting + PeriodLocking + FiscalPeriodsTxRepo — wiring tx-bound
 * dentro UoW callback per-tx):
 *   - `fiscalPeriods`: `new FiscalPeriodReaderAdapter()` zero-arg consume
 *     default-init `service = makeFiscalPeriodsService()` cross-module factory-
 *     wrap cementado C3.
 *   - `draftDocuments`: `new PrismaDraftDocumentsReaderAdapter(prisma)`
 *     module-level `prisma` outside-scope read-only pre-TX.
 *   - `uow`: `new PrismaMonthlyCloseUnitOfWork(repoLike)` internal assembly
 *     tx-bound 3 adapters dentro `withAuditTx` callback.
 *
 * NO test composition-root dedicado (mirror sale + iva-books + accounting +
 * fiscal-periods **4 evidencias precedent** — 5ta evidencia matures cumulative;
 * payment 1 evidencia opt-in axis-distinct): factory single-shot trivial
 * wiring; integration downstream (PrismaMonthlyCloseUnitOfWork + adapters
 * propios + cross-module FiscalPeriodsService via factory wrap) cubre el
 * shape end-to-end C5.
 */

const repoLike: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

export function makeMonthlyCloseService(): MonthlyCloseService {
  return new MonthlyCloseService({
    fiscalPeriods: new FiscalPeriodReaderAdapter(),
    draftDocuments: new PrismaDraftDocumentsReaderAdapter(prisma),
    uow: new PrismaMonthlyCloseUnitOfWork(repoLike),
  });
}
