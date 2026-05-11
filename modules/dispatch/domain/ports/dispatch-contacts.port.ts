/**
 * Outbound port for contact validation from dispatch-hex use cases.
 * Returns the contact's type and payment terms for dispatch operations.
 */
export interface DispatchContact {
  id: string;
  name: string;
  type: string;
  paymentTermsDays: number | null;
}

export interface DispatchContactsPort {
  getActiveById(
    organizationId: string,
    contactId: string,
  ): Promise<DispatchContact>;
}
