/**
 * Shape of the pre-filled values passed from `/[orgSlug]/payments/new` to
 * `PaymentForm` when the page is entered through the "registrar pago"
 * shortcut (`?type=COBRO&saleId=...` or `?type=PAGO&purchaseId=...`).
 *
 * Built in the Server Component from the `ok` branch of `fetchShortcutSource`.
 * Consumed by `PaymentForm` (Phase 4) as the `initialValues` prop.
 *
 * Money math (DEC-1): the helper returns `balance` as a `decimal.js` Decimal.
 * The Server Component coerces it to a JS number ONCE at this props boundary
 * (`toDecimalPlaces(2, ROUND_HALF_UP).toNumber()`) — Client Components never
 * receive a Decimal instance. Single coercion point.
 *
 * SDD change: register-payment-shortcut. Phase 3 (page wiring).
 */
export interface ShortcutInitialValues {
  /** Payment direction — locks the form to COBRO or PAGO. */
  type: "COBRO" | "PAGO";
  /** Pre-selected contact. */
  contactId: string;
  /** Pre-filled description (e.g. "Cobro Venta #42"). */
  description: string;
  /** Discriminates the source comprobante for UI labelling / back-links. */
  sourceKind: "sale" | "purchase";
  /** Sale or Purchase id — used for the back-link to the source page. */
  sourceId: string;
  /** Synthesized voucher code: `V-{seq}` for sales, `C-{seq}` for purchases. */
  voucherCode: string;
  /** External reference number on the source (may be null). */
  referenceNumber: string | null;
  /** Receivable / Payable id used to pre-check the allocation line. */
  allocationTargetId: string;
  /**
   * Outstanding balance on the source, coerced to JS number at the props
   * boundary. Two-decimal rounding (HALF_UP) is applied at coercion time.
   */
  allocationBalance: number;
}
