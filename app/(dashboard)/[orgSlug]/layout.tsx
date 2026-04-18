import { Badge } from "@/components/ui/badge";
import { DashboardShell } from "@/components/sidebar/dashboard-shell";
import { RolesMatrixProvider } from "@/components/common/roles-matrix-provider";
import { buildClientMatrixSnapshot } from "@/features/shared/client-matrix";
import { OrganizationsService } from "@/features/organizations";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const orgService = new OrganizationsService();

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
        <div className="bg-gray-50">
          {/* Organization Banner */}
          <div className="w-full border-b bg-white px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-sm font-medium leading-none">
                  {organization.name}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Espacio de trabajo
                </p>
              </div>
              <Badge variant="outline" className="px-2 py-0.5 text-xs">
                {membership.role}
              </Badge>
            </div>
          </div>

          {/* Main Content */}
          <div className="py-8">
            <div className="px-4 lg:px-8">{children}</div>
          </div>
        </div>
      </DashboardShell>
    </RolesMatrixProvider>
  );
}
