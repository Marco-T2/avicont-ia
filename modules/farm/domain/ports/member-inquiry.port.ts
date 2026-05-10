/**
 * Port consumed by the farm module to verify a member exists and is active
 * before assigning a farm. The adapter (in infrastructure/) wires this to
 * the organizations module without coupling our domain to its types.
 */
export interface MemberInquiryPort {
  /** Throws MemberInactiveOrMissing when the member is missing or deactivated. */
  assertActive(organizationId: string, memberId: string): Promise<void>;
}
