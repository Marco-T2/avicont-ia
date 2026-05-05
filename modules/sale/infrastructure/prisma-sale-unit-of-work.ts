import "server-only";

import type { AutoEntryGenerator } from "@/features/accounting/auto-entry-generator";
import { withAuditTx } from "@/features/shared/audit-tx";
import type { JournalEntriesReadPort } from "@/modules/accounting/domain/ports/journal-entries-read.port";
import { PrismaAccountBalancesRepo } from "@/modules/accounting/infrastructure/prisma-account-balances.repo";
import { PrismaJournalEntriesRepository } from "@/modules/accounting/infrastructure/prisma-journal-entries.repo";
import type { IvaBookService } from "@/modules/iva-books/application/iva-book.service";
import type { IvaBookScope } from "@/modules/iva-books/application/iva-book-unit-of-work";
import type { AccountLookupPort } from "@/modules/org-settings/domain/ports/account-lookup.port";
import { PrismaReceivablesRepository } from "@/modules/receivables/presentation/server";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import { PrismaFiscalPeriodsTxRepo } from "@/modules/shared/infrastructure/prisma-fiscal-periods-tx.repo";
import { Prisma } from "@/generated/prisma/client";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import type {
  SaleScope,
  SaleUnitOfWork,
} from "../application/sale-unit-of-work";
import { PrismaIvaBookRegenNotifierAdapter } from "./prisma-iva-book-regen-notifier.adapter";
import { PrismaIvaBookVoidCascadeAdapter } from "./prisma-iva-book-void-cascade.adapter";
import { PrismaJournalEntryFactoryAdapter } from "./prisma-journal-entry-factory.adapter";
import { PrismaSaleRepository } from "./prisma-sale.repository";

/**
 * Postgres-backed adapter for `SaleUnitOfWork` (POC #11.0a A3 Ciclo 6). Mirror
 * POC #10 `PrismaAccountingUnitOfWork` — delegates to `withAuditTx` so las 4
 * invariantes (correlationId pre-tx, SET LOCAL inside, fn invoke, return shape)
 * son inherited unchanged. Solo cambia el shape del scope: 6 superficies
 * tx-bound + fiscalPeriods (BaseScope) + correlationId.
 *
 * Cross-module deps inyectadas en constructor (Ciclo 4 D-2 c2 DI per-tx via
 * composition root): `journalEntriesReadPort`, `accountLookupPort`,
 * `autoEntryGen`, `ivaServiceFactory`, `ivaScopeFactory`. Los 6 scope members
 * tx-bound se construyen dentro del `withAuditTx` callback con la `tx` outer
 * compartida.
 *
 * **POC #11.0c A4-c C2 GREEN cutover hex (P1 (b) + cycle-break Opción α
 * lockeada Marco)**: `ivaServiceFactory: () => IvaBookService` retorna hex
 * (sin 's', POC #11.0c A4-b cascade surface F-α scope param). `ivaScopeFactory:
 * (tx, correlationId) => IvaBookScope` closure construido por iva root cierra
 * sobre prisma adapters iva-side — CERO cross-module concrete imports en sale
 * infrastructure adapter (§17 preservado). Notifier adapter recibe ambos
 * factories + correlationId para construir scope tx-bound al momento del
 * cascade hex call.
 *
 * `journalEntries` Prisma adapter se instancia una sola vez y se reusa como
 * `writeRepo` del `journalEntryFactory` (E-6.a α + paridad scope-bound POC #10).
 *
 * §17 carve-out: UoW construye adapters tx-bound dentro de `withAuditTx` —
 * `Prisma.TransactionClient` no existe pre-tx, un singleton en composition
 * root no puede capturar `tx` per-run. Cross-module concrete imports
 * cubiertos: `accounting/PrismaAccountBalancesRepo`,
 * `accounting/PrismaJournalEntriesRepository`,
 * `shared/PrismaFiscalPeriodsTxRepo`. Cada uno implementa un port definido
 * en `domain/` del módulo dueño (R3 vigente — la flecha apunta al dominio).
 */
export class PrismaSaleUnitOfWork implements SaleUnitOfWork {
  constructor(
    private readonly repo: UnitOfWorkRepoLike,
    private readonly journalEntriesReadPort: JournalEntriesReadPort,
    private readonly accountLookupPort: AccountLookupPort,
    private readonly autoEntryGen: AutoEntryGenerator,
    private readonly ivaServiceFactory: () => IvaBookService,
    private readonly ivaScopeFactory: (
      tx: Prisma.TransactionClient,
      correlationId: string,
    ) => IvaBookScope,
  ) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: SaleScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    return withAuditTx(this.repo, ctx, async (tx, correlationId) => {
      const journalEntriesRepo = new PrismaJournalEntriesRepository(tx);
      const scope: SaleScope = {
        correlationId,
        fiscalPeriods: new PrismaFiscalPeriodsTxRepo(tx),
        sales: new PrismaSaleRepository(tx),
        journalEntries: journalEntriesRepo,
        accountBalances: new PrismaAccountBalancesRepo(tx),
        receivables: new PrismaReceivablesRepository(tx),
        journalEntryFactory: new PrismaJournalEntryFactoryAdapter(
          tx,
          this.journalEntriesReadPort,
          this.accountLookupPort,
          journalEntriesRepo,
          this.autoEntryGen,
        ),
        ivaBookRegenNotifier: new PrismaIvaBookRegenNotifierAdapter(
          tx,
          correlationId,
          this.ivaServiceFactory,
          this.ivaScopeFactory,
        ),
        ivaBookVoidCascade: new PrismaIvaBookVoidCascadeAdapter(tx),
      };
      return fn(scope);
    });
  }
}
