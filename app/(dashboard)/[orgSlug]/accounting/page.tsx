import { redirect } from "next/navigation";
import { requireAuth } from "@/features/shared";
import { canAccess } from "@/features/permissions/server";
import {
  makeOrganizationsService,
  requireOrgAccess,
} from "@/modules/organizations/presentation/server";
import {
  makeAccountingDashboardService,
  makeJournalsService,
} from "@/modules/accounting/presentation/server";
import { DashboardProClient } from "@/components/accounting/dashboard-pro-client";
import { DashboardLight } from "@/components/accounting/dashboard-light";

interface AccountingPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function AccountingPage({ params }: AccountingPageProps) {
  const { orgSlug } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    return redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    return redirect("/select-org");
  }

  const member = await makeOrganizationsService().getMemberByClerkUserId(
    orgId,
    userId,
  );
  const role = member.role;

  // Pro view requires `financial-statements:read` because dashboard.load()
  // invokes FinancialStatementsService.generateIncomeStatement, which is
  // restricted to owner/admin/contador. Using `reports` here would let
  // cobrador in and crash with ForbiddenError from the inner service.
  const canViewPro = await canAccess(
    role,
    "financial-statements",
    "read",
    orgId,
  );

  if (canViewPro) {
    const data = await makeAccountingDashboardService().load(orgId, role);
    return (
      <div className="space-y-6">
        <Header />
        <DashboardProClient data={data} orgSlug={orgSlug} />
      </div>
    );
  }

  const entries = await makeJournalsService().list(orgId);
  const lastEntryDate =
    entries.length === 0
      ? null
      : isoDate(
          entries.reduce(
            (acc, e) => (e.date.getTime() > acc.getTime() ? e.date : acc),
            entries[0].date,
          ),
        );

  const lightResources = ["accounting-config", "journal", "reports"] as const;
  const lightChecks = await Promise.all(
    lightResources.map((r) => canAccess(role, r, "read", orgId)),
  );
  const allowedResources = lightResources.filter((_, i) => lightChecks[i]);

  return (
    <div className="space-y-6">
      <Header />
      <DashboardLight
        orgSlug={orgSlug}
        totalEntries={entries.length}
        lastEntryDate={lastEntryDate}
        allowedResources={allowedResources}
      />
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Contabilidad</h1>
      <p className="text-muted-foreground mt-1">
        Gestión contable de la organización
      </p>
    </div>
  );
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
