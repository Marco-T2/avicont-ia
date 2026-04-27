/**
 * C1 — SaleService.regenerateJournalForIvaChange discriminated-union signature.
 *
 * Per design D2.d, the method signature uses a single options object with the
 * following discriminated-union shape:
 *
 *   - { organizationId, saleId, userId }                                  (standalone)
 *   - { organizationId, saleId, userId, externalTx, correlationId }       (delegated)
 *
 * The type system MUST reject:
 *   - externalTx without correlationId
 *   - correlationId without externalTx
 *
 * These assertions use `@ts-expect-error` — they are compile-time guards. The
 * function bodies are wrapped in `if (false)` so the TS checker validates the
 * types without runtime execution (the test runner only verifies the file
 * loads cleanly; the real proof lives in `tsc --noEmit`).
 *
 * Pre-fix expected failure mode (RED):
 *   - The pre-fix signature is positional `(organizationId, saleId, userId, externalTx?)`,
 *     so calling with an options object FAILS to compile under `tsc --noEmit`,
 *     and the `@ts-expect-error` directives become "Unused directive" errors.
 */
import { describe, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import type { SaleService } from "@/features/sale/sale.service";

declare const service: SaleService;
declare const tx: Prisma.TransactionClient;

describe("regenerateJournalForIvaChange — discriminated union compile-time guard (sale)", () => {
  it("standalone shape compiles", () => {
    if (false) {
      void service.regenerateJournalForIvaChange({
        organizationId: "o1",
        saleId: "s1",
        userId: "u1",
      });
    }
  });

  it("with-externalTx shape compiles when correlationId is present", () => {
    if (false) {
      void service.regenerateJournalForIvaChange({
        organizationId: "o1",
        saleId: "s1",
        userId: "u1",
        externalTx: tx,
        correlationId: "uuid-1",
      });
    }
  });

  it("rejects externalTx without correlationId at compile time", () => {
    if (false) {
      // @ts-expect-error externalTx requires correlationId
      void service.regenerateJournalForIvaChange({
        organizationId: "o1",
        saleId: "s1",
        userId: "u1",
        externalTx: tx,
      });
    }
  });

  it("rejects correlationId without externalTx at compile time", () => {
    if (false) {
      // @ts-expect-error correlationId without externalTx is invalid
      void service.regenerateJournalForIvaChange({
        organizationId: "o1",
        saleId: "s1",
        userId: "u1",
        correlationId: "uuid-1",
      });
    }
  });
});
