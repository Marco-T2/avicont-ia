/**
 * Narrow read-only DTO of the org-settings fields the payment module needs:
 * the four account codes used by `buildEntryLines` to construct payment
 * journal entries (caja, banco, cxc, cxp). Defined locally so this port does
 * not import from `modules/org-settings/...`.
 */
export interface PaymentOrgSettings {
  cajaGeneralAccountCode: string;
  bancoAccountCode: string;
  cxcAccountCode: string;
  cxpAccountCode: string;
}

/**
 * Read-only port for org-settings consumed by payment use cases. Non-tx
 * because the legacy reads settings BEFORE entering the transaction (see
 * `payment.service.ts` line 120). Auto-creates the row on first access.
 */
export interface OrgSettingsReadPort {
  getOrCreate(organizationId: string): Promise<PaymentOrgSettings>;
}
