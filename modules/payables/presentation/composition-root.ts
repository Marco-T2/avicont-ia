import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { PayablesService } from "../application/payables.service";
import { PrismaPayablesRepository } from "../infrastructure/prisma-payables.repository";

export { PrismaPayablesRepository };
export { attachContact, attachContacts } from "../infrastructure/contact-attacher";
import { ContactsExistenceAdapter } from "../infrastructure/contacts-existence.adapter";
import { makeContactsServiceForTx } from "@/modules/contacts/presentation/server";

export function makePayablesService(): PayablesService {
  return new PayablesService(
    new PrismaPayablesRepository(),
    new ContactsExistenceAdapter(),
  );
}

export function makePayablesServiceForTx(
  tx: Prisma.TransactionClient,
): PayablesService {
  return new PayablesService(
    new PrismaPayablesRepository().withTransaction(tx),
    new ContactsExistenceAdapter(makeContactsServiceForTx(tx)),
  );
}

export function makePayablesRepository(): PrismaPayablesRepository {
  return new PrismaPayablesRepository();
}
