import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  ContactReadPort,
  ContactType,
} from "../../domain/ports/contact-read.port";

/**
 * Read-only, tx-aware adapter for the narrow `Contact.type` lookup the
 * payment direction resolver needs. Mirrors legacy
 * `payment.service.ts:1310` — selects `type` only, returns null when the
 * row does not exist (preserves the legacy B2 existence-validation gap).
 *
 * Mapping: CLIENTE / PROVEEDOR pass through. SOCIO / TRANSPORTISTA / OTRO
 * map to "OTHER" so the application layer throws PAYMENT_DIRECTION_REQUIRED
 * (legacy parity — see resolveDirection).
 */
export class LegacyContactReadAdapter implements ContactReadPort {
  async findType(
    tx: unknown,
    contactId: string,
  ): Promise<ContactType | null> {
    const row = await (tx as Prisma.TransactionClient).contact.findUnique({
      where: { id: contactId },
      select: { type: true },
    });
    if (!row) return null;
    if (row.type === "CLIENTE") return "CLIENTE";
    if (row.type === "PROVEEDOR") return "PROVEEDOR";
    return "OTHER";
  }
}
