import { Prisma, type AccountsReceivable } from "@/generated/prisma/client";
import { Receivable } from "../domain/receivable.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  parseReceivableStatus,
  type ReceivableStatus,
} from "../domain/value-objects/receivable-status";

export function toDomain(row: AccountsReceivable): Receivable {
  return Receivable.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    contactId: row.contactId,
    description: row.description,
    amount: MonetaryAmount.of(row.amount.toString()),
    paid: MonetaryAmount.of(row.paid.toString()),
    balance: MonetaryAmount.of(row.balance.toString()),
    dueDate: row.dueDate,
    status: parseReceivableStatus(row.status),
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    journalEntryId: row.journalEntryId,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

/**
 * Persistence-boundary guard (DEC-A, Batch 3-FIX F-1): OVERDUE must never be
 * WRITTEN to AccountsReceivable.status. Entry is closed upstream (zod write
 * enums + ALLOWED tables), but a legacy OVERDUE row rehydrated via toDomain
 * and written back — e.g. a description-only edit — would re-persist OVERDUE
 * verbatim while the settlement sync stamps JE.paymentStatus = PENDING: the
 * exact silent divergence DEC-A exists to eliminate. Fail LOUD; never
 * normalize silently. Draining happens via transitionTo (PARTIAL/PAID/
 * VOIDED), which produces a persistable status. Until Batch 5's sanitizing
 * migration, editing a still-OVERDUE legacy row throws here by design.
 *
 * Invoked at every repository write site that persists a caller-supplied
 * status: toPersistence (save), update, applyAllocationTx,
 * revertAllocationTx. createTx/voidTx write literal PENDING/VOIDED.
 */
export function assertPersistableStatus(status: ReceivableStatus): void {
  if (status === "OVERDUE") {
    throw new Error(
      "AccountsReceivable.status 'OVERDUE' is not persistable — the OVERDUE write surface is closed per DEC-A " +
        "(decision/overdue-write-surface-closure). Drain the row via transitionTo (PARTIAL/PAID/VOIDED) instead.",
    );
  }
}

export function toPersistence(entity: Receivable) {
  assertPersistableStatus(entity.status);
  return {
    id: entity.id,
    organizationId: entity.organizationId,
    contactId: entity.contactId,
    description: entity.description,
    amount: new Prisma.Decimal(entity.amount.value),
    paid: new Prisma.Decimal(entity.paid.value),
    balance: new Prisma.Decimal(entity.balance.value),
    dueDate: entity.dueDate,
    status: entity.status as ReceivableStatus,
    sourceType: entity.sourceType,
    sourceId: entity.sourceId,
    journalEntryId: entity.journalEntryId,
    notes: entity.notes,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
