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

export function toPersistence(entity: Payable) {
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
