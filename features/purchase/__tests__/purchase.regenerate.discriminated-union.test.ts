/**
 * C1 — PurchaseService.regenerateJournalForIvaChange discriminated-union signature.
 *
 * Mirrors sale.regenerate.discriminated-union.test.ts. See that file for full
 * rationale. The function bodies are wrapped in `if (false)` so TS validates
 * types without runtime execution.
 */
import { describe, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import type { PurchaseService } from "@/features/purchase/purchase.service";

declare const service: PurchaseService;
declare const tx: Prisma.TransactionClient;

describe("regenerateJournalForIvaChange — discriminated union compile-time guard (purchase)", () => {
  it("standalone shape compiles", () => {
    if (false) {
      void service.regenerateJournalForIvaChange({
        organizationId: "o1",
        purchaseId: "p1",
        userId: "u1",
      });
    }
  });

  it("with-externalTx shape compiles when correlationId is present", () => {
    if (false) {
      void service.regenerateJournalForIvaChange({
        organizationId: "o1",
        purchaseId: "p1",
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
        purchaseId: "p1",
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
        purchaseId: "p1",
        userId: "u1",
        correlationId: "uuid-1",
      });
    }
  });
});
