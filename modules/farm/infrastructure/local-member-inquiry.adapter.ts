import "server-only";
import { makeOrganizationsService } from "@/modules/organizations/presentation/server";
import type { OrganizationsService } from "@/modules/organizations/presentation/server";
import { MemberInactiveOrMissing } from "../domain/errors/farm-errors";
import type { MemberInquiryPort } from "../domain/ports/member-inquiry.port";

export class LocalMemberInquiryAdapter implements MemberInquiryPort {
  constructor(
    private readonly organizations: OrganizationsService = makeOrganizationsService(),
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
