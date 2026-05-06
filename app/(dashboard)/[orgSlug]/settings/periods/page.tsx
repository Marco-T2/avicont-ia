import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { Button } from "@/components/ui/button";
import PeriodList from "@/components/accounting/period-list";

interface PeriodsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function PeriodsPage({ params }: PeriodsPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("period", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const service = makeFiscalPeriodsService();
  const periods = (await service.list(orgId)).map((p) => p.toSnapshot());

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/settings`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Configuración
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Períodos Fiscales</h1>
        <p className="text-muted-foreground mt-1">
          Gestión de períodos contables de la organización
        </p>
      </div>

      <PeriodList
        orgSlug={orgSlug}
        periods={JSON.parse(JSON.stringify(periods))}
      />
    </div>
  );
}
