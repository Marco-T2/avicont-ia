import { DashboardShell } from "@/components/sidebar/dashboard-shell";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import { buildClientMatrixSnapshot } from "@/features/permissions/server";
import { makeOrganizationsService } from "@/modules/organizations/presentation/server";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const orgService = makeOrganizationsService();

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const { orgSlug } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  if (!orgSlug) {
    console.error("orgSlug is undefined");
    redirect("/dashboard");
  }

  let organization, membership;
  try {
    ({ organization, membership } = await orgService.getOrgLayoutData(orgSlug, userId));
  } catch {
    redirect("/select-org");
  }

  // PR7.1 — Fetch the caller's client-side matrix snapshot server-side and
  // pass it through a single provider that wraps the whole dashboard tree.
  // No loading flash (Option B from the PR7.1 design): the matrix is
  // resolved before the client tree is hydrated.
  const matrixSnapshot = await buildClientMatrixSnapshot(
    organization.id,
    membership.role,
  );

  return (
    <RolesMatrixProvider snapshot={matrixSnapshot}>
      <DashboardShell>
        <div className="bg-muted py-8">
          <div className="px-4 lg:px-8">{children}</div>
        </div>
      </DashboardShell>
    </RolesMatrixProvider>
  );
}
