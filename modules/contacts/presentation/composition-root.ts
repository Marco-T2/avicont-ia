import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ContactsService } from "../application/contacts.service";
import { PrismaContactRepository } from "../infrastructure/prisma-contact.repository";

export function makeContactsService(): ContactsService {
  return new ContactsService(new PrismaContactRepository());
}

export function makeContactsServiceForTx(
  tx: Prisma.TransactionClient,
): ContactsService {
  return new ContactsService(new PrismaContactRepository().withTransaction(tx));
}
