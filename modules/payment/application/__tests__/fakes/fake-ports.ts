import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  NotFoundError,
  ValidationError,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
} from "@/modules/shared/domain/errors";
import type {
  ReceivablesPort,
  ReceivableStatusValue,
  ReceivableGlosaMeta,
} from "../../../domain/ports/receivables.port";
import type {
  PayablesPort,
  PayableStatusValue,
} from "../../../domain/ports/payables.port";
import type {
  OrgSettingsReadPort,
  PaymentOrgSettings,
} from "../../../domain/ports/org-settings-read.port";
import type {
  FiscalPeriodsReadPort,
  PaymentFiscalPeriod,
} from "../../../domain/ports/fiscal-periods-read.port";
import type {
  AccountingPort,
  GenerateEntryParams,
  JournalEntrySnapshot,
  UpdateEntryParams,
  ResolvedEntryLine,
  AccountReference,
} from "../../../domain/ports/accounting.port";
import type { AccountBalancesPort } from "../../../domain/ports/account-balances.port";
import type {
  ContactReadPort,
  ContactType,
} from "../../../domain/ports/contact-read.port";
import type {
  CreditConsumptionPort,
  CreditConsumptionLink,
  WriteCreditConsumptionInput,
} from "../../../domain/ports/credit-consumption.port";

// ─────────────────────────── Receivables / Payables ─────────────────────────

export class FakeReceivablesPort implements ReceivablesPort {
  /** Fixture map: id → status. Unset → applyAllocation throws NotFoundError. */
  status = new Map<string, ReceivableStatusValue>();
  /**
   * Fixture map: id → contactId, for the same-contact scope guard
   * (supplier-scope-guard). Unseeded id → null (skip-on-null): existing tests
   * that don't configure it leave the guard with a null target → it skips the
   * compare. Cross-contact RED tests seed a DIFFERING contactId to trigger
   * PAYMENT_CREDIT_WRONG_CONTACT.
   */
  contactIds = new Map<string, string>();
  /**
   * Fixture map: id → current balance. Consumed by `applyAllocation` to
   * mirror the receivables-entity invariant (throws shared
   * PAYMENT_ALLOCATION_EXCEEDS_BALANCE when amount exceeds balance). When
   * unset for a tracked id, the fake skips the balance check so existing
   * tests that don't configure it are unaffected.
   */
  balance = new Map<string, number>();
  applyCalls: Array<{ id: string; amount: number }> = [];
  revertCalls: Array<{ id: string; amount: number }> = [];
  applyShouldThrow: Map<string, Error> = new Map();
  revertShouldThrow: Map<string, Error> = new Map();

  async getStatusByIdTx(
    _tx: unknown,
    _orgId: string,
    id: string,
  ): Promise<ReceivableStatusValue | null> {
    return this.status.get(id) ?? null;
  }

  async getContactIdByIdTx(
    _tx: unknown,
    _orgId: string,
    id: string,
  ): Promise<string | null> {
    return this.contactIds.get(id) ?? null;
  }

  async applyAllocation(
    _tx: unknown,
    _orgId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    const err = this.applyShouldThrow.get(id);
    if (err) throw err;
    const status = this.status.get(id);
    if (status === undefined) throw new NotFoundError("Cuenta por cobrar");
    if (status === "VOIDED") {
      throw new ValidationError(
        "No se puede aplicar pago a una cuenta por cobrar anulada",
        PAYMENT_ALLOCATION_TARGET_VOIDED,
      );
    }
    const bal = this.balance.get(id);
    if (bal !== undefined && amount.value > bal) {
      throw new ValidationError(
        `La asignación (${amount.value}) excede el saldo disponible (${bal}) de la CxC`,
        PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
      );
    }
    this.applyCalls.push({ id, amount: amount.value });
  }

  async revertAllocation(
    _tx: unknown,
    _orgId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    const err = this.revertShouldThrow.get(id);
    if (err) throw err;
    this.revertCalls.push({ id, amount: amount.value });
  }

  /**
   * Fixture map: AR id → glosa metadata (REQ-GE-2 LOOKUP-B). Unset ids are
   * silently omitted from the returned array — mirrors the adapter's
   * orphan-tolerant contract (caller's builder falls back to "DOC-<refNo>").
   */
  glosaMeta = new Map<string, Omit<ReceivableGlosaMeta, "id">>();

  async findGlosaMetaTx(
    _tx: unknown,
    _orgId: string,
    arIds: string[],
  ): Promise<ReceivableGlosaMeta[]> {
    const out: ReceivableGlosaMeta[] = [];
    for (const id of arIds) {
      const meta = this.glosaMeta.get(id);
      if (meta) {
        out.push({ id, ...meta });
      }
    }
    return out;
  }
}

export class FakePayablesPort implements PayablesPort {
  status = new Map<string, PayableStatusValue>();
  /** See FakeReceivablesPort.contactIds for rationale (skip-on-null guard). */
  contactIds = new Map<string, string>();
  /** See FakeReceivablesPort.balance for rationale. */
  balance = new Map<string, number>();
  applyCalls: Array<{ id: string; amount: number }> = [];
  revertCalls: Array<{ id: string; amount: number }> = [];
  applyShouldThrow: Map<string, Error> = new Map();
  revertShouldThrow: Map<string, Error> = new Map();

  async getStatusByIdTx(
    _tx: unknown,
    _orgId: string,
    id: string,
  ): Promise<PayableStatusValue | null> {
    return this.status.get(id) ?? null;
  }

  async getContactIdByIdTx(
    _tx: unknown,
    _orgId: string,
    id: string,
  ): Promise<string | null> {
    return this.contactIds.get(id) ?? null;
  }

  async applyAllocation(
    _tx: unknown,
    _orgId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    const err = this.applyShouldThrow.get(id);
    if (err) throw err;
    const status = this.status.get(id);
    if (status === undefined) throw new NotFoundError("Cuenta por pagar");
    if (status === "VOIDED") {
      throw new ValidationError(
        "No se puede aplicar pago a una cuenta por pagar anulada",
        PAYMENT_ALLOCATION_TARGET_VOIDED,
      );
    }
    const bal = this.balance.get(id);
    if (bal !== undefined && amount.value > bal) {
      throw new ValidationError(
        `La asignación (${amount.value}) excede el saldo disponible (${bal}) de la CxP`,
        PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
      );
    }
    this.applyCalls.push({ id, amount: amount.value });
  }

  async revertAllocation(
    _tx: unknown,
    _orgId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    const err = this.revertShouldThrow.get(id);
    if (err) throw err;
    this.revertCalls.push({ id, amount: amount.value });
  }
}

// ─────────────────────────── Org-settings + periods ─────────────────────────

export class FakeOrgSettingsReadPort implements OrgSettingsReadPort {
  fixture: PaymentOrgSettings = {
    cajaGeneralAccountCode: "1.1.1.1",
    bancoAccountCode: "1.1.2.1",
    cxcAccountCode: "1.1.4.1",
    cxpAccountCode: "2.1.1.1",
  };
  calls: string[] = [];

  async getOrCreate(orgId: string): Promise<PaymentOrgSettings> {
    this.calls.push(orgId);
    return this.fixture;
  }
}

/**
 * Storage shape interno: `name`, `startDate`, `endDate` opcionales (defaults sane
 * en `getById`) para no obligar a actualizar todos los tests legacy cuando el
 * port narrow se amplía. Adapter real siempre provee los 5 campos.
 */
type StoredPaymentFiscalPeriod = {
  id: string;
  status: "OPEN" | "CLOSED";
  name?: string;
  startDate?: Date;
  endDate?: Date;
};

export class FakeFiscalPeriodsReadPort implements FiscalPeriodsReadPort {
  /** Fixture map: id → period. Missing key → throws like legacy. */
  periods = new Map<string, StoredPaymentFiscalPeriod>();
  notFoundError = new Error("Período fiscal");

  async getById(_orgId: string, id: string): Promise<PaymentFiscalPeriod> {
    const p = this.periods.get(id);
    if (!p) throw this.notFoundError;
    return {
      id: p.id,
      status: p.status,
      name: p.name ?? `Período ${p.id}`,
      startDate: p.startDate ?? new Date("2000-01-01T00:00:00.000Z"),
      endDate: p.endDate ?? new Date("2099-12-31T23:59:59.999Z"),
    };
  }
}

// ─────────────────────────── Accounting + balances ──────────────────────────

export class FakeAccountingPort implements AccountingPort {
  /** Each call to generateEntryTx reads an entry from this queue (FIFO).
   * Tests can also assign a fallback fixture to `defaultEntry`. */
  generatedQueue: JournalEntrySnapshot[] = [];
  defaultEntry: JournalEntrySnapshot | null = null;
  generateCalls: GenerateEntryParams[] = [];
  voidCalls: Array<{ id: string; userId: string }> = [];
  updateCalls: Array<{
    id: string;
    data: UpdateEntryParams;
    lines: ResolvedEntryLine[];
    userId: string;
  }> = [];
  entries = new Map<string, JournalEntrySnapshot>();
  accountsByCode = new Map<string, AccountReference>();

  async generateEntryTx(
    _tx: unknown,
    params: GenerateEntryParams,
  ): Promise<JournalEntrySnapshot> {
    this.generateCalls.push(params);
    const next = this.generatedQueue.shift() ?? this.defaultEntry;
    if (!next) {
      throw new Error(
        "FakeAccountingPort.generateEntryTx: no entry queued (test fixture missing)",
      );
    }
    this.entries.set(next.id, next);
    return next;
  }

  async findEntryByIdTx(
    _tx: unknown,
    _orgId: string,
    id: string,
  ): Promise<JournalEntrySnapshot | null> {
    return this.entries.get(id) ?? null;
  }

  async voidEntryTx(
    _tx: unknown,
    _orgId: string,
    id: string,
    userId: string,
  ): Promise<JournalEntrySnapshot> {
    this.voidCalls.push({ id, userId });
    const e = this.entries.get(id);
    if (!e) {
      throw new Error(
        `FakeAccountingPort.voidEntryTx: entry ${id} not in fixture`,
      );
    }
    return e;
  }

  async updateEntryTx(
    _tx: unknown,
    _orgId: string,
    id: string,
    data: UpdateEntryParams,
    lines: ResolvedEntryLine[],
    userId: string,
  ): Promise<JournalEntrySnapshot> {
    this.updateCalls.push({ id, data, lines, userId });
    const existing = this.entries.get(id);
    if (!existing) {
      throw new Error(
        `FakeAccountingPort.updateEntryTx: entry ${id} not in fixture`,
      );
    }
    return existing;
  }

  async findAccountByCodeTx(
    _tx: unknown,
    _orgId: string,
    code: string,
  ): Promise<AccountReference | null> {
    return this.accountsByCode.get(code) ?? null;
  }
}

export class FakeAccountBalancesPort implements AccountBalancesPort {
  applyPostCalls: Array<{ entryId: string }> = [];
  applyVoidCalls: Array<{ entryId: string }> = [];

  async applyPostTx(_tx: unknown, entry: JournalEntrySnapshot): Promise<void> {
    this.applyPostCalls.push({ entryId: entry.id });
  }

  async applyVoidTx(_tx: unknown, entry: JournalEntrySnapshot): Promise<void> {
    this.applyVoidCalls.push({ entryId: entry.id });
  }
}

// ─────────────────────────── Contact-read ──────────────────────────────────

export class FakeContactReadPort implements ContactReadPort {
  types = new Map<string, ContactType>();
  names = new Map<string, string>();
  calls: string[] = [];
  nameCalls: string[] = [];

  async findType(_tx: unknown, contactId: string): Promise<ContactType | null> {
    this.calls.push(contactId);
    return this.types.get(contactId) ?? null;
  }

  async findName(_tx: unknown, contactId: string): Promise<string | null> {
    this.nameCalls.push(contactId);
    return this.names.get(contactId) ?? null;
  }
}

// ─────────────────────────── CreditConsumption ──────────────────────────────

/**
 * In-memory CreditConsumption bridge table. Each `writeTx` appends a row;
 * `findByConsumerPaymentIdTx` filters by consumer; `deleteByConsumerPaymentIdTx`
 * removes matching rows. Call vectors (`writeCalls`, `deleteCalls`) let tests
 * assert the link write/delete contract (Phase 3 — applyCredit v2 + revert v2).
 */
export class FakeCreditConsumptionPort implements CreditConsumptionPort {
  rows: WriteCreditConsumptionInput[] = [];
  writeCalls: WriteCreditConsumptionInput[] = [];
  deleteCalls: Array<{ organizationId: string; consumerPaymentId: string }> = [];

  async writeTx(
    _tx: unknown,
    input: WriteCreditConsumptionInput,
  ): Promise<void> {
    this.rows.push(input);
    this.writeCalls.push(input);
  }

  async findByConsumerPaymentIdTx(
    _tx: unknown,
    organizationId: string,
    consumerPaymentId: string,
  ): Promise<CreditConsumptionLink[]> {
    return this.rows
      .filter(
        (r) =>
          r.organizationId === organizationId &&
          r.consumerPaymentId === consumerPaymentId,
      )
      .map((r) => ({
        sourcePaymentId: r.sourcePaymentId,
        receivableId: r.receivableId,
        payableId: r.payableId,
        amount: r.amount,
        consumerPaymentId: r.consumerPaymentId,
      }));
  }

  async deleteByConsumerPaymentIdTx(
    _tx: unknown,
    organizationId: string,
    consumerPaymentId: string,
  ): Promise<void> {
    this.deleteCalls.push({ organizationId, consumerPaymentId });
    this.rows = this.rows.filter(
      (r) =>
        !(
          r.organizationId === organizationId &&
          r.consumerPaymentId === consumerPaymentId
        ),
    );
  }
}
