import type { Journal } from "@/modules/accounting/domain/journal.entity";
import type {
  JournalEntryFactoryPort,
  PurchaseJournalTemplate,
  RegenerateJournalResult,
  SaleJournalTemplate,
} from "@/modules/sale/domain/ports/journal-entry-factory.port";

/**
 * In-memory `JournalEntryFactoryPort` fake para purchase-hex application
 * tests. Espejo simétrico del fake sale-hex extendido con
 * `generateForPurchase` (port shared, hereda + extiende A2 step 0 lock).
 *
 * - `enqueuePurchase(...journals)`: queue FIFO para `generateForPurchase`.
 * - `purchaseCalls`: registro de cada template purchase recibido.
 * - `enqueueSale` / `saleCalls`: paridad simétrica (sale-hex no consume este
 *   fake; declarado por contract conformance).
 * - `regenerateForSaleEdit`: throws (purchase-hex no consume; sale-hex
 *   tiene su propio fake).
 */
export class InMemoryJournalEntryFactory implements JournalEntryFactoryPort {
  saleCalls: SaleJournalTemplate[] = [];
  purchaseCalls: PurchaseJournalTemplate[] = [];
  regenPurchaseCalls: { oldJournalId: string; template: PurchaseJournalTemplate }[] = [];
  private saleQueue: Journal[] = [];
  private purchaseQueue: Journal[] = [];
  private regenPurchaseQueue: RegenerateJournalResult[] = [];

  enqueueSale(...journals: Journal[]): void {
    this.saleQueue.push(...journals);
  }

  enqueuePurchase(...journals: Journal[]): void {
    this.purchaseQueue.push(...journals);
  }

  enqueueRegenPurchase(...results: RegenerateJournalResult[]): void {
    this.regenPurchaseQueue.push(...results);
  }

  async generateForSale(template: SaleJournalTemplate): Promise<Journal> {
    this.saleCalls.push(template);
    const next = this.saleQueue.shift();
    if (!next) {
      throw new Error(
        "InMemoryJournalEntryFactory: no sale Journal queued — call .enqueueSale(journal)",
      );
    }
    return next;
  }

  async generateForPurchase(
    template: PurchaseJournalTemplate,
  ): Promise<Journal> {
    this.purchaseCalls.push(template);
    const next = this.purchaseQueue.shift();
    if (!next) {
      throw new Error(
        "InMemoryJournalEntryFactory: no purchase Journal queued — call .enqueuePurchase(journal)",
      );
    }
    return next;
  }

  async regenerateForSaleEdit(): Promise<RegenerateJournalResult> {
    throw new Error(
      "InMemoryJournalEntryFactory.regenerateForSaleEdit not used by purchase-hex (sale-hex has its own fake)",
    );
  }

  async regenerateForPurchaseEdit(
    oldJournalId: string,
    template: PurchaseJournalTemplate,
  ): Promise<RegenerateJournalResult> {
    this.regenPurchaseCalls.push({ oldJournalId, template });
    const next = this.regenPurchaseQueue.shift();
    if (!next) {
      throw new Error(
        "InMemoryJournalEntryFactory: no regen purchase result queued — call .enqueueRegenPurchase({old, new})",
      );
    }
    return next;
  }
}
