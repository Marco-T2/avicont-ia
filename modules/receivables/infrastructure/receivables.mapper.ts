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

export function toPersistence(entity: Receivable) {
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
