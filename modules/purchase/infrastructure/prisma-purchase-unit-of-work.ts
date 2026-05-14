import "server-only";

import type { AutoEntryGenerator } from "@/modules/accounting/application/auto-entry-generator";
import { withAuditTx } from "@/features/shared/audit-tx";
import { Prisma } from "@/generated/prisma/client";
import type { JournalEntriesReadPort } from "@/modules/accounting/domain/ports/journal-entries-read.port";
import { PrismaAccountBalancesRepo } from "@/modules/accounting/infrastructure/prisma-account-balances.repo";
import { PrismaJournalEntriesRepository } from "@/modules/accounting/infrastructure/prisma-journal-entries.repo";
import type { IvaBookService } from "@/modules/iva-books/application/iva-book.service";
import type { IvaBookScope } from "@/modules/iva-books/application/iva-book-unit-of-work";
import type { AccountLookupPort } from "@/modules/org-settings/domain/ports/account-lookup.port";
import { PrismaPayablesRepository } from "@/modules/payables/presentation/server";
import { PrismaJournalEntryFactoryAdapter } from "@/modules/sale/infrastructure/prisma-journal-entry-factory.adapter";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import { PrismaFiscalPeriodsTxRepo } from "@/modules/shared/infrastructure/prisma-fiscal-periods-tx.repo";
import type { UnitOfWorkRepoLike } from "@/modules/shared/infrastructure/prisma-unit-of-work";

import type {
  PurchaseScope,
  PurchaseUnitOfWork,
} from "../application/purchase-unit-of-work";
import { PrismaIvaBookRegenNotifierAdapter } from "./prisma-iva-book-regen-notifier.adapter";
import { PrismaIvaBookVoidCascadeAdapter } from "./prisma-iva-book-void-cascade.adapter";
import { PrismaPurchaseRepository } from "./prisma-purchase.repository";

/**
 * Postgres-backed adapter for `PurchaseUnitOfWork` (POC #11.0b A3 Ciclo 6b).
 * Mirror sale C6 `PrismaSaleUnitOfWork` (commit `31830b0`) byte-equivalent
 * salvo asimetrías declaradas: `payables` ↔ `receivables`, factory
 * cross-module sale-side (purchase reusa `PrismaJournalEntryFactoryAdapter`
 * con `generateForPurchase`/`regenerateForPurchaseEdit` heredado A3 Ciclo 4
 * sale + extensión step 0 A2 #1378). Delegates a `withAuditTx` — las 4
 * invariantes (correlationId pre-tx, SET LOCAL inside, fn invoke, return
 * shape) son inherited unchanged. Solo cambia el shape del scope: 7
 * superficies tx-bound + fiscalPeriods (BaseScope) + correlationId.
 *
 * §13 E-6.a α NO emerge en C6 purchase — `PurchaseScope` ya tenía
 * `journalEntryFactory` INSIDE desde A2 (#1378); no requiere split 6-pre/6
 * vs sale C6 (diferencia clave heredada).
 *
 * Cross-module deps inyectadas en constructor (Ciclo 4 D-2 c2 DI per-tx via
 * composition root): `journalEntriesReadPort`, `accountLookupPort`,
 * `autoEntryGen`, `ivaServiceFactory`, `ivaScopeFactory`. Los 7 scope members
 * tx-bound se construyen dentro del `withAuditTx` callback con la `tx` outer
 * compartida.
 *
 * **POC #11.0c A4-c C2 GREEN cutover hex (P1 (b) + cycle-break Opción α
 * lockeada Marco)**: `ivaServiceFactory: () => IvaBookService` retorna hex
 * (sin 's', POC #11.0c A4-b cascade surface F-α scope param). `ivaScopeFactory:
 * (tx, correlationId) => IvaBookScope` closure construido por iva root cierra
 * sobre prisma adapters iva-side — CERO cross-module concrete imports en
 * purchase infrastructure adapter (§17 preservado). Notifier adapter recibe
 * ambos factories + correlationId para construir scope tx-bound al momento
 * del cascade hex call. Mirror simétrico sale UoW.
 *
 * `journalEntries` Prisma adapter se instancia una sola vez y se reusa como
 * `writeRepo` del `journalEntryFactory` (paridad scope-bound POC #10 + sale
 * E-6.a α).
 *
 * §17 carve-out: UoW construye adapters tx-bound dentro de `withAuditTx` —
 * `Prisma.TransactionClient` no existe pre-tx, un singleton en composition
 * root no puede capturar `tx` per-run. Cross-module concrete imports
 * cubiertos: `accounting/PrismaAccountBalancesRepo`,
 * `accounting/PrismaJournalEntriesRepository`,
 * `shared/PrismaFiscalPeriodsTxRepo`,
 * `sale/PrismaJournalEntryFactoryAdapter` (cross-module adicional vs sale
 * C6; bookmark E-2 POC #11.0c reorg cross-module ports por dominio target).
 * Cada uno implementa un port definido en `domain/` del módulo dueño (R3
 * vigente — la flecha apunta al dominio).
 */
export class PrismaPurchaseUnitOfWork implements PurchaseUnitOfWork {
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
    fn: (scope: PurchaseScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    return withAuditTx(this.repo, ctx, async (tx, correlationId) => {
      const journalEntriesRepo = new PrismaJournalEntriesRepository(tx);
      const scope: PurchaseScope = {
        correlationId,
        fiscalPeriods: new PrismaFiscalPeriodsTxRepo(tx),
        purchases: new PrismaPurchaseRepository(tx),
        journalEntries: journalEntriesRepo,
        accountBalances: new PrismaAccountBalancesRepo(tx),
        payables: new PrismaPayablesRepository(tx),
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
