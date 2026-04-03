import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import ReportsPageClient from "@/components/accounting/reports-page-client";

interface ReportsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function ReportsPage({ params }: ReportsPageProps) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reportes Contables</h1>
        <p className="text-gray-500 mt-1">
          Balance de comprobacion y reportes financieros
        </p>
      </div>

      <ReportsPageClient orgSlug={orgSlug} />
    </div>
  );
}
