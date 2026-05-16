/**
 * Phase 5.1 RED — annual-close presentation composition root.
 *
 * Asserts that `modules/annual-close/presentation/composition-root.ts` exists
 * and exports `makeAnnualCloseService(): AnnualCloseService` (zero-arg factory,
 * cumulative-precedent EXACT — sale/payment/fiscal-periods/iva-books/accounting/
 * monthly-close all zero-arg).
 *
 * Declared failure mode (pre-GREEN):
 *   - `existsSync` returns false → POS existence test FAILS.
 *   - `await import(...)` rejects (ENOENT) → factory existence test FAILS.
 *
 * Per [[red_acceptance_failure_mode]]: this is the legitimate RED failure
 * mode for a NEW-file phase. GREEN flips when 5.2 lands composition-root.ts.
 *
 * Per design rev 2 §6: composition root wires
 *   - PrismaFiscalYearReaderAdapter(prisma)         OWN module
 *   - PrismaYearAccountingReaderAdapter(prisma)     OWN module
 *   - PrismaDraftDocumentsReaderAdapter(prisma)     §17 cross-module REUSE
 *   - PrismaAnnualCloseUnitOfWork(repoLike)         OWN module (internal assembly)
 *
 * Mirror precedent EXACT (monthly-close composition-root.ts) — no §17 cite
 * cumulative absoluto, R4 carve-out cite in JSDoc.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../../..");
const REL = "modules/annual-close/presentation/composition-root.ts";

describe("Phase 5.1 RED — annual-close composition root", () => {
  it("composition-root.ts file exists", () => {
    expect(existsSync(resolve(ROOT, REL))).toBe(true);
  });

  it("exports zero-arg factory `makeAnnualCloseService`", async () => {
    const mod = await import(
      "@/modules/annual-close/presentation/composition-root"
    );
    expect(typeof mod.makeAnnualCloseService).toBe("function");
    expect(mod.makeAnnualCloseService.length).toBe(0);
  });

  it("factory returns an AnnualCloseService instance with `close` and `getSummary` methods", async () => {
    const { makeAnnualCloseService } = await import(
      "@/modules/annual-close/presentation/composition-root"
    );
    const svc = makeAnnualCloseService();
    expect(typeof svc.close).toBe("function");
    expect(typeof svc.getSummary).toBe("function");
  });
});
