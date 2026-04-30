import type {
  AuditContext,
  BaseScope,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { IvaSalesBookEntryRepository } from "../../../domain/ports/iva-sales-book-entry-repository.port";
import type { IvaPurchaseBookEntryRepository } from "../../../domain/ports/iva-purchase-book-entry-repository.port";
import type {
  IvaBookScope,
  IvaBookUnitOfWork,
} from "../../iva-book-unit-of-work";

function unused<T extends object>(name: string): T {
  return new Proxy({}, {
    get(_target, prop) {
      throw new Error(
        `InMemoryIvaBookUnitOfWork: scope.${name}.${String(prop)} not wired in fake — pass an explicit fake to constructor`,
      );
    },
  }) as T;
}

export interface InMemoryIvaBookUnitOfWorkOptions {
  ivaSalesBooks: IvaSalesBookEntryRepository;
  ivaPurchaseBooks: IvaPurchaseBookEntryRepository;
  fiscalPeriods?: BaseScope["fiscalPeriods"];
}

/**
 * In-memory `IvaBookUnitOfWork` for IVA-hex application tests. Records
 * `AuditContext` per `run` invocation. Mirror simétrico de
 * `InMemorySaleUnitOfWork` POC #11.0a.
 */
export class InMemoryIvaBookUnitOfWork implements IvaBookUnitOfWork {
  ranContexts: AuditContext[] = [];
  nextCorrelationId: string | null = null;
  private counter = 0;

  constructor(private readonly options: InMemoryIvaBookUnitOfWorkOptions) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: IvaBookScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    const correlationId =
      this.nextCorrelationId ?? `corr-iva-test-${++this.counter}`;
    this.nextCorrelationId = null;
    this.ranContexts.push(ctx);

    const scope: IvaBookScope = {
      correlationId,
      ivaSalesBooks: this.options.ivaSalesBooks,
      ivaPurchaseBooks: this.options.ivaPurchaseBooks,
      fiscalPeriods: this.options.fiscalPeriods ?? unused("fiscalPeriods"),
    };

    const result = await fn(scope);
    return { result, correlationId };
  }
}
