import "server-only";
import type { Contact } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Payable, PayableSnapshot } from "../domain/payable.entity";

/**
 * Hydrates `Payable` snapshot con `contact` via `.toSnapshot()` direct entity →
 * snapshot mapping (Opción C precedent A5-C1 — drop Decimal reconstruction overhead
 * post-C5-C6 §13.B-paired DTO drop axis paired NEW classification).
 */

export async function attachContacts(
  organizationId: string,
  items: Payable[],
): Promise<(PayableSnapshot & { contact: Contact })[]> {
  if (items.length === 0) return [];
  const ids = [...new Set(items.map((p) => p.contactId))];
  const rows = await prisma.contact.findMany({
    where: { organizationId, id: { in: ids } },
  });
  const byId = new Map(rows.map((c) => [c.id, c]));
  return items.map((p) => ({ ...p.toSnapshot(), contact: byId.get(p.contactId)! }));
}

export async function attachContact(
  organizationId: string,
  p: Payable,
): Promise<PayableSnapshot & { contact: Contact }> {
  const contact = await prisma.contact.findFirst({
    where: { id: p.contactId, organizationId },
  });
  return { ...p.toSnapshot(), contact: contact! };
}
