/**
 * Read port for org-settings as consumed by dispatch-hex use cases.
 * Mirror: modules/sale/domain/ports/org-settings-reader.port.ts pattern.
 *
 * Returns the settings snapshot needed for dispatch operations
 * (roundingThreshold, cxcAccountCode).
 */
export interface OrgSettingsSnapshot {
  roundingThreshold: number;
  cxcAccountCode: string;
}

export interface DispatchOrgSettingsReaderPort {
  getOrCreate(organizationId: string): Promise<OrgSettingsSnapshot>;
}
