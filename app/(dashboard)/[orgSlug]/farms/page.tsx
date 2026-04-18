import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { canAccess } from "@/features/shared/permissions";
import { OrganizationsService } from "@/features/organizations";
import { FarmsService } from "@/features/farms";
import FarmsPageClient from "./farms-client";

const orgService = new OrganizationsService();

interface FarmsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function FarmsPage({ params }: FarmsPageProps) {
  const { orgSlug } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  let member;
  try {
    member = await orgService.getMemberByClerkUserId(orgId, userId);
  } catch {
    redirect("/select-org");
  }

  const farmsService = new FarmsService();
  const canManageFarms = canAccess(member.role, "members", "write");
  const farms = canManageFarms
    ? await farmsService.list(orgId)
    : await farmsService.listByMember(orgId, member.id);

  return (
    <div className="space-y-8">
      <FarmsPageClient orgSlug={orgSlug} memberId={member.id} farms={farms} />
    </div>
  );
}
