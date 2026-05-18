import type {
  AuditContext,
  BaseScope,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { AccountBalancesRepository } from "@/modules/accounting/domain/ports/account-balances.repo";
import type { JournalEntriesRepository } from "@/modules/accounting/domain/ports/journal-entries.repo";
import type { ReceivableRepository } from "@/modules/receivables/domain/receivable.repository";
import type { SaleRepository } from "../../../domain/ports/sale.repository";
import type { JournalEntryFactoryPort } from "../../../domain/ports/journal-entry-factory.port";
import type {
  SaleScope,
  SaleUnitOfWork,
} from "../../sale-unit-of-work";

/**
 * Returns a Proxy that throws for any access — used to populate scope fields
 * the current Ciclo's use cases never touch. If a use case accidentally
 * reaches into the unimplemented branch, the test fails loud with the field
 * name in the error message.
 */
function unused<T extends object>(name: string): T {
  return new Proxy({}, {
    get(_target, prop) {
      throw new Error(
        `InMemorySaleUnitOfWork: scope.${name}.${String(prop)} not wired in fake — pass an explicit fake to constructor`,
      );
    },
  }) as T;
}

export interface InMemorySaleUnitOfWorkOptions {
  sales: SaleRepository;
  fiscalPeriods?: BaseScope["fiscalPeriods"];
  journalEntries?: JournalEntriesRepository;
  accountBalances?: AccountBalancesRepository;
  receivables?: ReceivableRepository;
  journalEntryFactory?: JournalEntryFactoryPort;
}

/**
 * In-memory `SaleUnitOfWork` for sale-hex application tests. Records the
 * `AuditContext` of every `run` invocation so tests can assert audit semantics.
 * Generates a deterministic-but-unique `correlationId` per run — tests can
 * inject overrides via the `nextCorrelationId` field if needed.
 *
 * IVA cascade fields retired in lcv-feature-retirement (RND 102100000011
 * Dec-2021).
 */
export class InMemorySaleUnitOfWork implements SaleUnitOfWork {
  ranContexts: AuditContext[] = [];
  nextCorrelationId: string | null = null;
  private counter = 0;

  constructor(private readonly options: InMemorySaleUnitOfWorkOptions) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: SaleScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    const correlationId =
      this.nextCorrelationId ?? `corr-test-${++this.counter}`;
    this.nextCorrelationId = null;
    this.ranContexts.push(ctx);

    const scope: SaleScope = {
      correlationId,
      sales: this.options.sales,
      fiscalPeriods: this.options.fiscalPeriods ?? unused("fiscalPeriods"),
      journalEntries:
        this.options.journalEntries ?? unused("journalEntries"),
      accountBalances:
        this.options.accountBalances ?? unused("accountBalances"),
      receivables: this.options.receivables ?? unused("receivables"),
      journalEntryFactory:
        this.options.journalEntryFactory ?? unused("journalEntryFactory"),
    };

    const result = await fn(scope);
    return { result, correlationId };
  }
}
