import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { MonthlyClosePanel } from "@/components/accounting/monthly-close-panel";

const periodsService = makeFiscalPeriodsService();

interface MonthlyClosePageProps {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ periodId?: string }>;
}

/**
 * /accounting/monthly-close?periodId={id}
 *
 * The only legitimate entry is the per-row "Cerrar" link from
 * `/{orgSlug}/settings/periods` (annual-period-list.tsx:301), which carries
 * `?periodId=...`. Landing here without a valid OPEN periodId redirects back
 * to `/settings/periods` — the page used to render a combobox letting the
 * user pick any period, but that risked manually closing December and
 * breaking annual-close atomicity (Dec must be locked inside the same tx as
 * CC + auto-periods + CA per annual-close.service.ts:491-559).
 */
export default async function MonthlyClosePage({ params, searchParams }: MonthlyClosePageProps) {
  const { orgSlug } = await params;
  const { periodId } = await searchParams;

  let orgId: string;
  try {
    const result = await requirePermission("period", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const periods = (await periodsService.list(orgId)).map((p) => p.toSnapshot());

  const period = periodId
    ? periods.find((p) => p.id === periodId && p.status === "OPEN")
    : undefined;

  if (!period) {
    redirect(`/${orgSlug}/settings/periods`);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${orgSlug}/settings/periods`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Períodos Fiscales
        </Link>
        <h1 className="text-3xl font-bold">Cierre Mensual</h1>
        <p className="text-muted-foreground mt-1">
          Revisión y cierre de períodos fiscales
        </p>
      </div>

      <MonthlyClosePanel
        orgSlug={orgSlug}
        selectedPeriod={{
          id: period.id,
          name: period.name,
          startDate: period.startDate.toISOString(),
          endDate: period.endDate.toISOString(),
          status: period.status,
        }}
      />
    </div>
  );
}
