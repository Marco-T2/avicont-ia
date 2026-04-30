import type {
  AuditContext,
  BaseScope,
} from "@/modules/shared/domain/ports/unit-of-work";
import type { PurchaseRepository } from "../../../domain/ports/purchase.repository";
import type {
  PurchaseScope,
  PurchaseUnitOfWork,
} from "../../purchase-unit-of-work";

/**
 * Returns a Proxy that throws for any access — usado para poblar campos del
 * scope que el ciclo actual de use cases nunca toca. Si un use case
 * accidentalmente alcanza la rama no implementada, el test falla loud con
 * el field name en el mensaje. Espejo simétrico a sale-hex.
 */
function unused<T extends object>(name: string): T {
  return new Proxy({}, {
    get(_target, prop) {
      throw new Error(
        `InMemoryPurchaseUnitOfWork: scope.${name}.${String(prop)} not wired in fake — pass an explicit fake to constructor`,
      );
    },
  }) as T;
}

export interface InMemoryPurchaseUnitOfWorkOptions {
  purchases: PurchaseRepository;
  fiscalPeriods?: BaseScope["fiscalPeriods"];
}

/**
 * In-memory `PurchaseUnitOfWork` para purchase-hex application tests.
 * Registra el `AuditContext` de cada `run` invocation así los tests pueden
 * hacer assertions sobre semántica de auditoría. Genera un `correlationId`
 * deterministic-but-unique por run; tests pueden inyectar overrides via el
 * field `nextCorrelationId`. Espejo simétrico a `InMemorySaleUnitOfWork`.
 */
export class InMemoryPurchaseUnitOfWork implements PurchaseUnitOfWork {
  ranContexts: AuditContext[] = [];
  nextCorrelationId: string | null = null;
  private counter = 0;

  constructor(private readonly options: InMemoryPurchaseUnitOfWorkOptions) {}

  async run<T>(
    ctx: AuditContext,
    fn: (scope: PurchaseScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    const correlationId =
      this.nextCorrelationId ?? `corr-test-${++this.counter}`;
    this.nextCorrelationId = null;
    this.ranContexts.push(ctx);

    const scope: PurchaseScope = {
      correlationId,
      purchases: this.options.purchases,
      fiscalPeriods: this.options.fiscalPeriods ?? unused("fiscalPeriods"),
    };

    const result = await fn(scope);
    return { result, correlationId };
  }
}
