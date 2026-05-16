import "server-only";

import { prisma } from "@/lib/prisma";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";
import { PrismaDraftDocumentsReaderAdapter } from "@/modules/monthly-close/infrastructure/prisma-draft-documents-reader.adapter";

import { AnnualCloseService } from "../application/annual-close.service";
import { PrismaAnnualCloseUnitOfWork } from "../infrastructure/prisma-annual-close-unit-of-work";
import { PrismaFiscalYearReaderAdapter } from "../infrastructure/prisma-fiscal-year-reader.adapter";
import { PrismaYearAccountingReaderAdapter } from "../infrastructure/prisma-year-accounting-reader.adapter";

/**
 * Composition root for the annual-close module (Phase 5.2 GREEN, design
 * rev 2 §6) — único punto de wiring de adapters concretos a
 * `AnnualCloseService`. Mirror precedent EXACT
 * `modules/monthly-close/presentation/composition-root.ts` (zero-arg factory
 * + `repoLike` pattern + 4 deps wiring directos).
 *
 * **R4 carve-out** (architecture.md): único archivo bajo `presentation/`
 * autorizado a importar de `infrastructure/`. ESLint glob
 * `eslint.config.mjs:152` `modules/<m>/presentation/composition-root.ts`
 * cubre este archivo automáticamente sin modificación.
 *
 * **§17 carve-out — cross-module infrastructure import**: a diferencia de
 * la mayoría de composition roots (que no citan §17 — cumulative-precedent
 * absoluto), annual-close consume `PrismaDraftDocumentsReaderAdapter`
 * cross-module desde `@/modules/monthly-close/infrastructure/`. Justificación
 * R3 (consumer-driven port reuse — design rev 2 §4): la pre-TX gate de
 * annual-close necesita `DraftDocumentsReaderPort.countDraftsByPeriod` para
 * diciembre cuando se sigue el standard path. Componer
 * `MonthlyCloseService` directamente forzaría composition-of-services y
 * arrastraría su UoW (nested TX + re-`setAuditContext` con nuevo
 * `correlationId` mid-flujo). Reusar el adapter del módulo monthly-close
 * mantiene la composición chata: un solo TX, un `correlationId`, un audit
 * context.
 *
 * **NO §17 cite para los demás adapters** — `PrismaFiscalYearReaderAdapter`,
 * `PrismaYearAccountingReaderAdapter`, `PrismaAnnualCloseUnitOfWork` son
 * todos propios del módulo annual-close (R4 carve-out cubre).
 *
 * **Factory zero-arg** `makeAnnualCloseService(): AnnualCloseService`
 * cumulative-precedent EXACT 6 evidencias supersede absoluto (sale + payment
 * + fiscal-periods + iva-books + accounting + monthly-close — 7ma evidencia
 * matures cumulative annual-close NEW). Internamente factory consume `prisma`
 * module-level via `import { prisma } from "@/lib/prisma"` convención #4 (3+
 * evidencias EXACT).
 *
 * **NO memoización** mirror sale + payment + fiscal-periods + accounting +
 * monthly-close 5 evidencias supersede — single-instance per-call adecuado.
 *
 * `repoLike` pattern paridad sale/iva-books/accounting/monthly-close 4
 * evidencias EXACT cumulative — thin wrapper sobre `prisma.$transaction`
 * que `PrismaAnnualCloseUnitOfWork` consume vía `withAuditTx` (las 4
 * invariantes correlationId pre-tx, SET LOCAL inside, fn invoke, return
 * shape inherited unchanged) + 4to arg `{timeout: 60_000}` annual-specific
 * (S-4 design rev 2 §5 — diverge de los 30_000 de monthly-close por carga
 * 5 cross-table aggregates + CC + 5 lock cascades + 12 period creates + CA
 * + FY markClosed).
 *
 * **Wiring 4 deps directos** (composition root toca 4 adapters explicit;
 * otros 6 — Accounting + PeriodLocking + FiscalPeriods + FiscalYearWriterTx +
 * YearAccountingReaderTx + ClosingJournals + PeriodAutoCreator — wiring
 * tx-bound dentro UoW callback per-tx):
 *   - `fiscalYearReader`: `new PrismaFiscalYearReaderAdapter(prisma)` —
 *     pre-TX gate + getSummary reader (FY status, period counts, Dec, CC
 *     existence, result-account lookup).
 *   - `yearAccountingReader`: `new PrismaYearAccountingReaderAdapter(prisma)`
 *     — pre-TX C-1 + C-4 unconditional year-aggregate balance gate +
 *     getSummary balance field.
 *   - `draftDocuments`: `new PrismaDraftDocumentsReaderAdapter(prisma)` —
 *     §17 cross-module REUSE (monthly-close own port + adapter); reads
 *     Dec drafts on standard path.
 *   - `uow`: `new PrismaAnnualCloseUnitOfWork(repoLike)` internal assembly
 *     tx-bound 7 adapters dentro `withAuditTx` callback + 60s timeout +
 *     SET LOCAL lock_timeout/statement_timeout (S-4).
 */

const repoLike: UnitOfWorkRepoLike = {
  transaction: (fn, options) => prisma.$transaction(fn, options),
};

export function makeAnnualCloseService(): AnnualCloseService {
  return new AnnualCloseService({
    fiscalYearReader: new PrismaFiscalYearReaderAdapter(prisma),
    yearAccountingReader: new PrismaYearAccountingReaderAdapter(prisma),
    draftDocuments: new PrismaDraftDocumentsReaderAdapter(prisma),
    uow: new PrismaAnnualCloseUnitOfWork(repoLike),
  });
}
