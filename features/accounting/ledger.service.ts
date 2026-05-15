import "server-only";
import type { LedgerService as HexLedgerService } from "@/modules/accounting/presentation/server";
import type { LedgerEntry, TrialBalanceRow, DateRangeFilter } from "./ledger.types";

/**
 * Thin delegating SHIM over the hex `LedgerService`.
 *
 * POC #7 OLEADA 6 sub-POC 7/8 — C5 Option B2a. `LedgerService` was folded onto
 * the hex in C1 (`modules/accounting/application/ledger.service.ts` — it had
 * ZERO hex equivalent before). C5 B2a converts this legacy file from the full
 * implementation into a thin shim: the class name + public method signatures
 * are PRESERVED so the `@/features/accounting/server` barrel and the
 * `app/api/.../ledger/route.ts` consumer stay byte-stable (their repoint to
 * the hex factory is sub-POC 8 scope).
 *
 * Pure pass-through — the hex `LedgerService` has IDENTICAL public method
 * signatures and return DTOs (`LedgerEntry[]` / `TrialBalanceRow[]`), so no
 * shape reconciliation is needed. The DEV-1 / R-money float `Number()`
 * running-balance arithmetic lives in the hex now (named deviation, design
 * #2405) — this shim adds nothing.
 *
 * ── Lazy hex resolution (cycle break) ──
 * `makeLedgerService` lives in the hex `composition-root` (full adapter
 * graph). A static import would make the legacy `@/features/accounting/server`
 * barrel transitively pull the hex wiring graph at module-init, which has a
 * load-order cycle with `modules/organizations`. Resolving the factory via a
 * lazy `import()` cached in a module-level promise removes the static
 * module-graph edge — the hex barrel only loads on the first method call.
 * Both shim methods are already `async`. Mirrors the journal.service.ts shim.
 */
let hexFactoryPromise: Promise<() => HexLedgerService> | null = null;

async function resolveHex(): Promise<HexLedgerService> {
  if (!hexFactoryPromise) {
    hexFactoryPromise = import("@/modules/accounting/presentation/server").then(
      (m) => m.makeLedgerService,
    );
  }
  return (await hexFactoryPromise)();
}

export class LedgerService {
  async getAccountLedger(
    organizationId: string,
    accountId: string,
    dateRange?: DateRangeFilter,
    periodId?: string,
  ): Promise<LedgerEntry[]> {
    return (await resolveHex()).getAccountLedger(
      organizationId,
      accountId,
      dateRange,
      periodId,
    );
  }

  async getTrialBalance(
    organizationId: string,
    periodId: string,
  ): Promise<TrialBalanceRow[]> {
    return (await resolveHex()).getTrialBalance(organizationId, periodId);
  }
}
