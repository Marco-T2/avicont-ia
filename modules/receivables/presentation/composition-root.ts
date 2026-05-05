import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ReceivablesService } from "../application/receivables.service";
import { PrismaReceivablesRepository } from "../infrastructure/prisma-receivables.repository";

export { PrismaReceivablesRepository };
export { attachContact, attachContacts } from "../infrastructure/contact-attacher";
import { ContactsExistenceAdapter } from "../infrastructure/contacts-existence.adapter";
import { makeContactsServiceForTx } from "@/modules/contacts/presentation/server";

export function makeReceivablesService(): ReceivablesService {
  return new ReceivablesService(
    new PrismaReceivablesRepository(),
    new ContactsExistenceAdapter(),
  );
}

export function makeReceivablesServiceForTx(
  tx: Prisma.TransactionClient,
): ReceivablesService {
  return new ReceivablesService(
    new PrismaReceivablesRepository().withTransaction(tx),
    new ContactsExistenceAdapter(makeContactsServiceForTx(tx)),
  );
}

export function makeReceivablesRepository(): PrismaReceivablesRepository {
  return new PrismaReceivablesRepository();
}
