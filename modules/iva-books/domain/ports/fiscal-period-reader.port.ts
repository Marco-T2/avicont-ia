/**
 * Read-only port for fiscal periods consumed by IVA-hex use cases. Non-tx —
 * el periodo se lee antes de que la UoW tx abra (paridad con
 * `accounting/.../fiscal-periods-read.port.ts` y
 * `payment/.../fiscal-periods-read.port.ts`). El adapter MUST throw
 * NotFoundError cuando el periodo no existe (legacy parity).
 *
 * **D-A1#4 elevation (POC #11.0c A2)** — declarado **OBLIGATORIO** en
 * IVA-hex (no opcional). Razón estructural: sale-hex
 * `regenerateJournalForIvaChange` NO valida periodo internamente
 * (delegado al legacy bridge `maybeRegenerateJournal`), mientras
 * purchase-hex SÍ valida periodo INSIDE el use case. Esa asimetría
 * deja el path sale sin period gate en el flujo IVA-hex → sale-hex —
 * IVA-hex DEBE validar periodo en su lado para cubrir ambos paths.
 *
 * **Cross-module note (§11.1 rule of three)** — shape literal idéntico:
 * `accounting/.../fiscal-periods-read.port.ts:AccountingFiscalPeriod` y
 * `payment/.../fiscal-periods-read.port.ts:PaymentFiscalPeriod` ya tienen
 * ports own duplicados. IVA-hex es el 3rd port own duplicate. Sale-hex y
 * purchase-hex son consumers indirectos del port de accounting via
 * cross-module import. Promote a `modules/shared/domain/ports/`
 * **scheduled** para POC #11.0c A5 reorg E-2 (extiende E-2 reorg
 * cross-module ports: OrgSettingsReader + JournalEntryFactory +
 * FiscalPeriodReader). Promote diferido por scope reduction §18 — refactor
 * cross-module ~20 archivos no es momento mid-A2 (paralelo D acknowledge
 * ports cascade legacy retire A5 patrón).
 */
export interface IvaFiscalPeriod {
  id: string;
  status: "OPEN" | "CLOSED";
}

export interface FiscalPeriodReaderPort {
  getById(
    organizationId: string,
    periodId: string,
  ): Promise<IvaFiscalPeriod>;
}
