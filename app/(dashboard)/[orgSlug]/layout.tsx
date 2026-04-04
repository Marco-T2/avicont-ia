import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardShell } from "@/components/sidebar/dashboard-shell";
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

  return (
    <DashboardShell>
      <div className="bg-gray-50 min-h-full">
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
          <div className="container mx-auto px-4">{children}</div>
        </div>
      </div>
    </DashboardShell>
  );
}