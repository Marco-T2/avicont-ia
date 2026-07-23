import { Prisma, type AccountsPayable } from "@/generated/prisma/client";
import { Payable } from "../domain/payable.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  parsePayableStatus,
  type PayableStatus,
} from "../domain/value-objects/payable-status";

export function toDomain(row: AccountsPayable): Payable {
  return Payable.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    contactId: row.contactId,
    description: row.description,
    amount: MonetaryAmount.of(row.amount.toString()),
    paid: MonetaryAmount.of(row.paid.toString()),
    balance: MonetaryAmount.of(row.balance.toString()),
    dueDate: row.dueDate,
    status: parsePayableStatus(row.status),
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
 * WRITTEN to AccountsPayable.status. Entry is closed upstream (zod write
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
export function assertPersistableStatus(status: PayableStatus): void {
  if (status === "OVERDUE") {
    throw new Error(
      "AccountsPayable.status 'OVERDUE' is not persistable — the OVERDUE write surface is closed per DEC-A " +
        "(decision/overdue-write-surface-closure). Drain the row via transitionTo (PARTIAL/PAID/VOIDED) instead.",
    );
  }
}

export function toPersistence(entity: Payable) {
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
    status: entity.status as PayableStatus,
    sourceType: entity.sourceType,
    sourceId: entity.sourceId,
    journalEntryId: entity.journalEntryId,
    notes: entity.notes,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  };
}
