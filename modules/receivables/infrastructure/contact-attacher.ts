import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { AccountsReceivable, Contact } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Receivable } from "../domain/receivable.entity";

/**
 * Hydrates `Receivable` con `contact` + reconstructs `Prisma.Decimal` mapper para
 * legacy POJO `ReceivableWithContact` shape (boundary hex Option A push INTO
 * infrastructure/ — R5 honored).
 */
type ReceivableWithContact = AccountsReceivable & { contact: Contact };

export async function attachContacts(
  organizationId: string,
  items: Receivable[],
): Promise<ReceivableWithContact[]> {
  if (items.length === 0) return [];
  const ids = [...new Set(items.map((r) => r.contactId))];
  const rows = await prisma.contact.findMany({
    where: { organizationId, id: { in: ids } },
  });
  const byId = new Map(rows.map((c) => [c.id, c]));
  return items.map((r) => toReceivableWithContact(r, byId.get(r.contactId)!));
}

export async function attachContact(
  organizationId: string,
  r: Receivable,
): Promise<ReceivableWithContact> {
  const contact = await prisma.contact.findFirst({
    where: { id: r.contactId, organizationId },
  });
  return toReceivableWithContact(r, contact!);
}

function toReceivableWithContact(
  r: Receivable,
  contact: ReceivableWithContact["contact"],
): ReceivableWithContact {
  return {
    id: r.id,
    organizationId: r.organizationId,
    contactId: r.contactId,
    description: r.description,
    amount: new Prisma.Decimal(r.amount.value),
    paid: new Prisma.Decimal(r.paid.value),
    balance: new Prisma.Decimal(r.balance.value),
    dueDate: r.dueDate,
    status: r.status as ReceivableWithContact["status"],
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    journalEntryId: r.journalEntryId,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    contact,
  };
}
