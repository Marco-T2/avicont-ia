import type { Payment } from "../../../domain/payment.entity";
import type {
  PaymentRepository,
  PaymentFilters,
  UnappliedPaymentSnapshot,
  CustomerBalanceSnapshot,
} from "../../../domain/payment.repository";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";

/**
 * In-memory PaymentRepository used by the application-layer test suite.
 *
 * Persistence model: identity map keyed by id. `save` / `update` / `saveTx` /
 * `updateTx` all overwrite the slot — there is no diffing, no allocation
 * delete-then-create, no Prisma. This matches the contract: "the aggregate
 * computes its state, the repo persists the snapshot."
 *
 * Test-fixture knobs:
 *   - preload(payment[]) — seed the store before the test
 *   - savedTxIds / updatedTxIds — assert which ids hit a tx-aware writer
 *   - findByIdTxCalls — assert the orchestrator loaded inside the tx
 *
 * The `transaction()` method satisfies the `RepoLike` shape of withAuditTx —
 * it just runs the callback synchronously with a sentinel `tx` token.
 */
export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly store = new Map<string, Payment>();

  /** Sentinel passed to fn(tx, correlationId) by transaction(). Tests can
   * compare against repo.txToken to assert tx propagation.
   *
   * Implements `$executeRawUnsafe` as a no-op so `setAuditContext` (which
   * runs inside withAuditTx BEFORE the user fn) does not throw. The audit
   * SQL is observable via `executeRawCalls` for tests that care.
   */
  readonly executeRawCalls: Array<unknown[]> = [];
  readonly queryRawCalls: Array<unknown[]> = [];
  readonly txToken: {
    __memoryTx: true;
    $executeRawUnsafe: (...args: unknown[]) => Promise<number>;
    $queryRawUnsafe: (...args: unknown[]) => Promise<unknown[]>;
  } = {
    __memoryTx: true,
    $executeRawUnsafe: async (...args: unknown[]) => {
      this.executeRawCalls.push(args);
      return 0;
    },
    $queryRawUnsafe: async (...args: unknown[]) => {
      this.queryRawCalls.push(args);
      return [];
    },
  };

  saveCalls: Array<{ id: string }> = [];
  updateCalls: Array<{ id: string }> = [];
  saveTxCalls: Array<{ id: string }> = [];
  updateTxCalls: Array<{ id: string }> = [];
  deleteCalls: Array<{ id: string; orgId: string }> = [];
  deleteTxCalls: Array<{ id: string; orgId: string }> = [];
  findByIdTxCalls: Array<{ orgId: string; id: string }> = [];
  unappliedFixtures = new Map<string, UnappliedPaymentSnapshot[]>();
  customerBalanceFixtures = new Map<string, CustomerBalanceSnapshot>();

  preload(...payments: Payment[]): void {
    for (const p of payments) this.store.set(p.id, p);
  }

  reset(): void {
    this.store.clear();
    this.saveCalls = [];
    this.updateCalls = [];
    this.saveTxCalls = [];
    this.updateTxCalls = [];
    this.deleteCalls = [];
    this.deleteTxCalls = [];
    this.findByIdTxCalls = [];
    this.unappliedFixtures.clear();
    this.customerBalanceFixtures.clear();
  }

  /** Satisfies the RepoLike shape consumed by withAuditTx. */
  async transaction<T>(
    fn: (tx: unknown) => Promise<T>,
  ): Promise<T> {
    return fn(this.txToken);
  }

  // ── Reads ──

  async findAll(orgId: string, filters?: PaymentFilters): Promise<Payment[]> {
    return [...this.store.values()].filter((p) => {
      if (p.organizationId !== orgId) return false;
      if (filters?.status && p.status !== filters.status) return false;
      if (filters?.method && p.method !== filters.method) return false;
      if (filters?.contactId && p.contactId !== filters.contactId) return false;
      if (filters?.periodId && p.periodId !== filters.periodId) return false;
      return true;
    });
  }

  async findPaginated(
    orgId: string,
    filters?: PaymentFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>> {
    const all = await this.findAll(orgId, filters);
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const start = (page - 1) * pageSize;
    const items = all.slice(start, start + pageSize);
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, total, page, pageSize, totalPages };
  }

  async findById(orgId: string, id: string): Promise<Payment | null> {
    const p = this.store.get(id);
    return p && p.organizationId === orgId ? p : null;
  }

  async findByIdTx(
    _tx: unknown,
    orgId: string,
    id: string,
  ): Promise<Payment | null> {
    this.findByIdTxCalls.push({ orgId, id });
    const p = this.store.get(id);
    return p && p.organizationId === orgId ? p : null;
  }

  async findUnappliedByContact(
    _orgId: string,
    contactId: string,
    _excludePaymentId?: string,
  ): Promise<UnappliedPaymentSnapshot[]> {
    return this.unappliedFixtures.get(contactId) ?? [];
  }

  async getCustomerBalance(
    _orgId: string,
    contactId: string,
  ): Promise<CustomerBalanceSnapshot> {
    return (
      this.customerBalanceFixtures.get(contactId) ?? {
        totalInvoiced: 0,
        totalPaid: 0,
        netBalance: 0,
        unappliedCredit: 0,
      }
    );
  }

  // ── Writes ──

  async save(payment: Payment): Promise<void> {
    this.saveCalls.push({ id: payment.id });
    this.store.set(payment.id, payment);
  }

  async update(payment: Payment): Promise<void> {
    this.updateCalls.push({ id: payment.id });
    this.store.set(payment.id, payment);
  }

  async delete(orgId: string, id: string): Promise<void> {
    this.deleteCalls.push({ id, orgId });
    const p = this.store.get(id);
    if (p && p.organizationId === orgId) this.store.delete(id);
  }

  async saveTx(_tx: unknown, payment: Payment): Promise<void> {
    this.saveTxCalls.push({ id: payment.id });
    this.store.set(payment.id, payment);
  }

  async updateTx(_tx: unknown, payment: Payment): Promise<void> {
    this.updateTxCalls.push({ id: payment.id });
    this.store.set(payment.id, payment);
  }

  async deleteTx(_tx: unknown, orgId: string, id: string): Promise<void> {
    this.deleteTxCalls.push({ id, orgId });
    const p = this.store.get(id);
    if (p && p.organizationId === orgId) this.store.delete(id);
  }
}
