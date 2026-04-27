import type { OpenAggregate, PendingDocumentSnapshot } from "./types";

export interface PayablesQueryPort {
  aggregateOpen(
    organizationId: string,
    contactId: string,
  ): Promise<OpenAggregate>;
  findPendingByContact(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]>;
}
