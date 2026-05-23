/**
 * B-2 — RED: Type-shape test for payable.repository port glosa fields.
 *
 * glosa-pago mirrors the live AR→COBRO denormalized-sourceTypeCode pipeline
 * onto AP→PAGO (design D4/D6). This test asserts the port carries the same
 * glosa-feeding fields the receivable port already has (receivable.repository
 * :31/:37/:43/:84):
 *   - CreatePayableTxData.sourceTypeCode?: string | null   (D4)
 *   - PendingDocumentSnapshot.sourceTypeCode: string | null (D6)
 *   - PendingDocumentSnapshot.referenceNumber: number | null (D6)
 *   - PendingDocumentSnapshot.sourceDate: Date              (D6)
 *
 * RED failure mode: these fields are absent on the payable port today, so
 * each `expectTypeOf<...["field"]>()` reference fails `tsc --noEmit` with
 * TS2339 "Property 'field' does not exist on type" — the type-shape test
 * does not compile. GREEN (B-3) adds the fields and tsc passes.
 */

import { describe, it, expectTypeOf } from "vitest";
import type {
  CreatePayableTxData,
  PendingDocumentSnapshot,
} from "../payable.repository";

describe("payable.repository port — glosa field shape (D4/D6)", () => {
  it("CreatePayableTxData carries optional sourceTypeCode (D4)", () => {
    expectTypeOf<CreatePayableTxData["sourceTypeCode"]>().toEqualTypeOf<
      string | null | undefined
    >();
  });

  it("PendingDocumentSnapshot carries sourceTypeCode/referenceNumber/sourceDate (D6)", () => {
    expectTypeOf<PendingDocumentSnapshot["sourceTypeCode"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<PendingDocumentSnapshot["referenceNumber"]>().toEqualTypeOf<
      number | null
    >();
    expectTypeOf<PendingDocumentSnapshot["sourceDate"]>().toEqualTypeOf<Date>();
  });
});
