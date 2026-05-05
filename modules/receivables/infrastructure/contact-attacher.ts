import "server-only";
import type { Contact } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type { Receivable, ReceivableSnapshot } from "../domain/receivable.entity";

/**
 * Hydrates `Receivable` snapshot con `contact` via `.toSnapshot()` direct entity →
 * snapshot mapping (Opción C precedent A5-C1 — drop Decimal reconstruction overhead
 * post-C5-C6 §13.B-paired DTO drop axis paired NEW classification).
 */

export async function attachContacts(
  organizationId: string,
  items: Receivable[],
): Promise<(ReceivableSnapshot & { contact: Contact })[]> {
  if (items.length === 0) return [];
  const ids = [...new Set(items.map((r) => r.contactId))];
  const rows = await prisma.contact.findMany({
    where: { organizationId, id: { in: ids } },
  });
  const byId = new Map(rows.map((c) => [c.id, c]));
  return items.map((r) => ({ ...r.toSnapshot(), contact: byId.get(r.contactId)! }));
}

export async function attachContact(
  organizationId: string,
  r: Receivable,
): Promise<ReceivableSnapshot & { contact: Contact }> {
  const contact = await prisma.contact.findFirst({
    where: { id: r.contactId, organizationId },
  });
  return { ...r.toSnapshot(), contact: contact! };
}
