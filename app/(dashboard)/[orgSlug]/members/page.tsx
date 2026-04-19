import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { MembersService } from "@/features/organizations/server";
import MembersPageClient from "@/components/members/members-page-client";

interface MembersPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function MembersPage({ params }: MembersPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("members", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const service = new MembersService();
  const members = await service.listMembers(orgId);

  return (
    <div className="space-y-8">
      <MembersPageClient orgSlug={orgSlug} members={members} />
    </div>
  );
}
