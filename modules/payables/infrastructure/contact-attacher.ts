import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AccountsPayable, Contact } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Payable } from "../domain/payable.entity";

/**
 * Hydrates `Payable` con `contact` + reconstructs `Prisma.Decimal` mapper para
 * legacy POJO `PayableWithContact` shape (boundary hex Option A push INTO
 * infrastructure/ — R5 honored).
 */
type PayableWithContact = AccountsPayable & { contact: Contact };

export async function attachContacts(
  organizationId: string,
  items: Payable[],
): Promise<PayableWithContact[]> {
  if (items.length === 0) return [];
  const ids = [...new Set(items.map((p) => p.contactId))];
  const rows = await prisma.contact.findMany({
    where: { organizationId, id: { in: ids } },
  });
  const byId = new Map(rows.map((c) => [c.id, c]));
  return items.map((p) => toPayableWithContact(p, byId.get(p.contactId)!));
}

export async function attachContact(
  organizationId: string,
  p: Payable,
): Promise<PayableWithContact> {
  const contact = await prisma.contact.findFirst({
    where: { id: p.contactId, organizationId },
  });
  return toPayableWithContact(p, contact!);
}

function toPayableWithContact(
  p: Payable,
  contact: PayableWithContact["contact"],
): PayableWithContact {
  return {
    id: p.id,
    organizationId: p.organizationId,
    contactId: p.contactId,
    description: p.description,
    amount: new Prisma.Decimal(p.amount.value),
    paid: new Prisma.Decimal(p.paid.value),
    balance: new Prisma.Decimal(p.balance.value),
    dueDate: p.dueDate,
    status: p.status as PayableWithContact["status"],
    sourceType: p.sourceType,
    sourceId: p.sourceId,
    journalEntryId: p.journalEntryId,
    notes: p.notes,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    contact,
  };
}
