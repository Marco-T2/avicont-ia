/**
 * Read-side port for the "registrar pago" shortcut flow (application-layer
 * helper `fetchShortcutSource`). Captures EXACTLY the query surface that
 * helper needs from the Sale / Purchase tables plus their AR/AP siblings —
 * no more, no less. Extracted as part of the [PRISMA] cluster paydown (D4):
 * the helper used to import `@/lib/prisma` directly (R5 violation, live DB
 * client reached from application/). The port lets application depend on an
 * abstraction; the concrete Prisma query lives in the infrastructure adapter
 * (`modules/payment/infrastructure/adapters/prisma-shortcut-source-query.adapter.ts`).
 *
 * `balance` is projected as a `string` (not `Prisma.Decimal` / `decimal.js`)
 * so this port carries ZERO Prisma coupling at the type level — the adapter
 * does the `.toString()` conversion at the boundary. The application helper
 * feeds the string straight into `new Decimal(...)`, unchanged behaviour.
 *
 * `referenceNumber` mirrors the Prisma schema's `Int?` column on both `Sale`
 * and `Purchase` — narrow projection, not the full row.
 */

export interface ShortcutReceivable {
  id: string;
  balance: string;
}

export interface ShortcutSale {
  id: string;
  organizationId: string;
  status: string;
  contactId: string;
  sequenceNumber: number;
  referenceNumber: number | null;
  receivable: ShortcutReceivable | null;
}

export interface ShortcutPayable {
  id: string;
  balance: string;
}

export interface ShortcutPurchase {
  id: string;
  organizationId: string;
  status: string;
  contactId: string;
  sequenceNumber: number;
  referenceNumber: number | null;
  payable: ShortcutPayable | null;
}

export interface ShortcutSourceQueryPort {
  /**
   * Mirrors `prisma.sale.findUnique({ where: { id }, include: { receivable: true } })`.
   * Returns null when no sale matches `id`.
   */
  findSaleWithReceivable(id: string): Promise<ShortcutSale | null>;

  /**
   * Mirrors `prisma.purchase.findUnique({ where: { id }, include: { payable: true } })`.
   * Returns null when no purchase matches `id`.
   */
  findPurchaseWithPayable(id: string): Promise<ShortcutPurchase | null>;
}
