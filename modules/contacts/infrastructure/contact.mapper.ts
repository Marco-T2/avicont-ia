import type { Contact as ContactRow, Prisma } from "@/generated/prisma/client";
import { Contact } from "../domain/contact.entity";
import { Nit } from "../domain/value-objects/nit";
import { PaymentTermsDays } from "../domain/value-objects/payment-terms-days";
import { CreditLimit } from "../domain/value-objects/credit-limit";
import { parseContactType } from "../domain/value-objects/contact-type";

export function toDomain(row: ContactRow): Contact {
  return Contact.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    type: parseContactType(row.type),
    name: row.name,
    nit: row.nit ? Nit.of(row.nit) : null,
    email: row.email,
    phone: row.phone,
    address: row.address,
    paymentTermsDays: PaymentTermsDays.of(row.paymentTermsDays),
    creditLimit:
      row.creditLimit !== null && row.creditLimit !== undefined
        ? CreditLimit.of(Number(row.creditLimit))
        : null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function toPersistenceCreate(
  contact: Contact,
): Prisma.ContactUncheckedCreateInput {
  const snap = contact.toSnapshot();
  return {
    id: snap.id,
    organizationId: snap.organizationId,
    type: snap.type,
    name: snap.name,
    nit: snap.nit,
    email: snap.email,
    phone: snap.phone,
    address: snap.address,
    paymentTermsDays: snap.paymentTermsDays,
    creditLimit: snap.creditLimit,
    isActive: snap.isActive,
  };
}

export function toPersistenceUpdate(
  contact: Contact,
): Prisma.ContactUncheckedUpdateInput {
  const snap = contact.toSnapshot();
  return {
    type: snap.type,
    name: snap.name,
    nit: snap.nit,
    email: snap.email,
    phone: snap.phone,
    address: snap.address,
    paymentTermsDays: snap.paymentTermsDays,
    creditLimit: snap.creditLimit,
    isActive: snap.isActive,
  };
}
