/**
 * C-5 — glosa-pago Batch C backfill unit verification.
 *
 * Verifies the pure per-type mapping used by
 * `scripts/backfill-ap-source-type-code.ts` (design D9). The script mirrors the
 * AR backfill template (scripts/backfill-ar-source-type-code.ts): per-type,
 * NULL-guarded, idempotent UPDATEs. The mapping is extracted to a pure exported
 * helper so it can be unit-tested without a DB or the prisma client
 * (Extract-Before-Mock; sibling precedent payment-form.glosa-helpers.ts).
 *
 * Mapping (parity with purchaseTypeToCode at
 * modules/accounting/shared/infrastructure/document-type-codes.ts:25):
 *   FLETE → FL, POLLO_FAENADO → PF, COMPRA_GENERAL → CG, SERVICIO → SV
 *   unknown / null → null (orphan-safe; row stays NULL, builder fallback "DOC")
 */
import { describe, expect, it } from "vitest";
import { purchaseTypeToBackfillCode } from "../../scripts/backfill-ap-source-type-code";

describe("AP sourceTypeCode backfill — purchaseType mapping (C-5, design D9)", () => {
  it("maps each PurchaseType to its operational code", () => {
    expect(purchaseTypeToBackfillCode("FLETE")).toBe("FL");
    expect(purchaseTypeToBackfillCode("POLLO_FAENADO")).toBe("PF");
    expect(purchaseTypeToBackfillCode("COMPRA_GENERAL")).toBe("CG");
    expect(purchaseTypeToBackfillCode("SERVICIO")).toBe("SV");
  });

  it("returns null for unknown / null purchaseType (orphan-safe, no coercion)", () => {
    expect(purchaseTypeToBackfillCode(null)).toBeNull();
    expect(purchaseTypeToBackfillCode("MYSTERY")).toBeNull();
  });
});
