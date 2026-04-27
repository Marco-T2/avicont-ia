import "server-only";
import type { Contact as ContactRow } from "@/generated/prisma/client";
import {
  makeContactsService,
  type Contact as ContactEntity,
} from "@/modules/contacts/presentation/server";
import { PrismaContactRepository as ModuleContactRepository } from "@/modules/contacts/infrastructure/prisma-contact.repository";
import { makeContactBalancesService } from "@/modules/contact-balances/presentation/server";
import type {
  ContactBalanceSummary,
  ContactFilters,
  ContactWithBalance,
  CreateContactInput,
  PendingDocument,
  UpdateContactInput,
} from "./contacts.types";

const toLegacyShape = (entity: ContactEntity): ContactRow =>
  entity.toSnapshot() as unknown as ContactRow;

/**
 * @deprecated Backward-compat wrapper around the hexagonal contacts modules.
 * - CRUD methods delegate to `@/modules/contacts/presentation/server`.
 * - Balance methods (getCreditBalance, getPendingDocuments, getBalanceSummary,
 *   listWithBalances) delegate to `@/modules/contact-balances/presentation/server`.
 *
 * The legacy `setReceivablesService` / `setPayablesService` injection points
 * are intentionally absent: balance wiring now lives in
 * `modules/contact-balances/composition-root.ts`. The legacy setters were
 * never invoked anywhere in the repo, so balance summaries previously always
 * returned zero — fixed as part of this migration.
 *
 * The shim translates domain entities back to the Prisma `Contact` row shape
 * via `toSnapshot()`. The snapshot's keys are a structural superset of the
 * Prisma type; numeric fields (e.g. `creditLimit`) come back as `number`
 * instead of `Prisma.Decimal`, which is safe because every existing consumer
 * already wraps reads in `Number(...)`.
 */
export class ContactsService {
  // ── CRUD ──
  async list(
    organizationId: string,
    filters?: ContactFilters,
  ): Promise<ContactRow[]> {
    const entities = await makeContactsService().list(organizationId, filters);
    return entities.map(toLegacyShape);
  }

  async getById(organizationId: string, id: string): Promise<ContactRow> {
    return toLegacyShape(
      await makeContactsService().getById(organizationId, id),
    );
  }

  async getActiveById(organizationId: string, id: string): Promise<ContactRow> {
    return toLegacyShape(
      await makeContactsService().getActiveById(organizationId, id),
    );
  }

  async create(
    organizationId: string,
    input: CreateContactInput,
  ): Promise<ContactRow> {
    return toLegacyShape(
      await makeContactsService().create(organizationId, input),
    );
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateContactInput,
  ): Promise<ContactRow> {
    return toLegacyShape(
      await makeContactsService().update(organizationId, id, input),
    );
  }

  async deactivate(organizationId: string, id: string): Promise<ContactRow> {
    return toLegacyShape(
      await makeContactsService().deactivate(organizationId, id),
    );
  }

  // ── Balance ──
  async getCreditBalance(
    organizationId: string,
    contactId: string,
  ): Promise<number> {
    return makeContactBalancesService().getCreditBalance(
      organizationId,
      contactId,
    );
  }

  async getPendingDocuments(
    organizationId: string,
    contactId: string,
    type: "receivable" | "payable",
  ): Promise<PendingDocument[]> {
    return makeContactBalancesService().getPendingDocuments(
      organizationId,
      contactId,
      type,
    );
  }

  async getBalanceSummary(
    organizationId: string,
    contactId: string,
  ): Promise<ContactBalanceSummary> {
    return makeContactBalancesService().getBalanceSummary(
      organizationId,
      contactId,
    );
  }

  async listWithBalances(
    organizationId: string,
    filters?: ContactFilters,
  ): Promise<ContactWithBalance[]> {
    const items = await makeContactBalancesService().listWithBalances(
      organizationId,
      filters,
    );
    return items.map(({ contact, balanceSummary }) => ({
      ...toLegacyShape(contact),
      balanceSummary,
    }));
  }
}

/**
 * @deprecated Backward-compat re-export of the new module's adapter.
 * Cross-feature consumers that previously imported the legacy
 * `ContactsRepository` class get the new Prisma adapter instead.
 */
export const ContactsRepository = ModuleContactRepository;
export type ContactsRepository = InstanceType<typeof ModuleContactRepository>;

export {
  createContactSchema,
  updateContactSchema,
  contactFiltersSchema,
} from "@/modules/contacts/presentation/server";
