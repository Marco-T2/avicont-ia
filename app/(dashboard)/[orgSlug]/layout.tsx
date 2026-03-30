import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

interface OrgLayoutProps {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>; // Add Promise wrapper
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  // Await the params
  const { orgSlug } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Check if orgSlug is defined
  if (!orgSlug) {
    console.error("orgSlug is undefined");
    redirect("/dashboard");
  }

  // Get organization
  const organization = await prisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!organization) {
    redirect("/select-org");
  }

  // Check if user is member
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId: organization.id,
      user: { clerkUserId: userId },
    },
  });

  if (!membership) {
    redirect("/select-org");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Organization Banner */}
      <Card className="w-full shadow-sm border">
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {organization.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                Organization workspace
              </p>
            </div>
            <Badge variant="outline" className="px-4 py-1.5 font-medium">
              {membership.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <main className="py-8">
        <div className="container mx-auto px-4">{children}</div>
      </main>
    </div>
  );
}