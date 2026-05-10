import "server-only";
import { OrganizationsService } from "@/features/organizations/server";
import { MemberInactiveOrMissing } from "../domain/errors/farm-errors";
import type { MemberInquiryPort } from "../domain/ports/member-inquiry.port";

export class LocalMemberInquiryAdapter implements MemberInquiryPort {
  constructor(
    private readonly organizations: OrganizationsService = new OrganizationsService(),
  ) {}

  async assertActive(organizationId: string, memberId: string): Promise<void> {
    const member = await this.organizations.getMemberById(
      organizationId,
      memberId,
    );
    if (!member || member.deactivatedAt !== null) {
      throw new MemberInactiveOrMissing(memberId);
    }
  }
}

export { MemberInactiveOrMissing };
