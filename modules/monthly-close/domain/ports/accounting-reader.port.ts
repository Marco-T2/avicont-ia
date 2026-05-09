import type { Money } from "@/modules/shared/domain/value-objects/money";

/**
 * Read-only port for accounting balance aggregation consumed by monthly-close
 * orchestrator use case. SRP-isolated — solo `sumDebitCredit` balance gate
 * accounting domain (cross-entity counts Dispatch/Payment/JE/Sale/Purchase
 * defer C1.5/C2 axis-distinct, IvaBooksReaderPort DROP scope C1
 * recon-evidence-based YAGNI sin driver real).
 *
 * **Cross-module §13 fiscal-periods-C 8va evidencia paired D1 cementación**:
 * port own outbound, infra adapter C3 wraps accounting hex factory
 * (sumDebitCredit raw SQL JOIN `journal_lines` + `journal_entries` POSTED
 * pertenece accounting domain responsabilidad — currently inline raw SQL
 * `features/monthly-close/monthly-close.repository.ts:108-131` legacy
 * pre-hex). Tx-agnostic en domain layer; UoW C3 wires tx context.
 *
 * **Snapshot LOCAL Money VO reuse pattern NEW §13 sub-evidencia variant 1ra
 * evidencia POC monthly-close** — `MonthlyClosePeriodBalance` VO-typed
 * (paired sister §13 #1655 primitive-typed `IvaFiscalPeriod` 8va evidencia
 * cumulative cross-module). Marco lock GREEN opción (d) reuse Money VO
 * existente `modules/shared/domain/value-objects/money.ts`:
 *   - Coherente domain pure (NO Prisma leak R5)
 *   - Money VO 4ta cementación cross-POC matures (sale + payment + payables +
 *     monthly-close)
 *   - Service-level eq via `Money.equals()` método VO native
 *   - NO type alias redundante (b violation rule-of-three si emerge cross-module)
 */
export interface MonthlyClosePeriodBalance {
  debit: Money;
  credit: Money;
}

export interface AccountingReaderPort {
  sumDebitCredit(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyClosePeriodBalance>;
}
