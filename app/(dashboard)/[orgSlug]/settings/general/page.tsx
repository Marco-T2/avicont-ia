import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
import { Button } from "@/components/ui/button";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";

const settingsService = makeOrgSettingsService();

interface SettingsGeneralPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsGeneralPage({
  params,
}: SettingsGeneralPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission(
      "accounting-config",
      "write",
      orgSlug,
    );
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const settings = (await settingsService.getOrCreate(orgId)).toSnapshot();

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/settings`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Configuración
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Configuración General</h1>
        <p className="text-muted-foreground mt-1">
          Cuentas contables y parámetros de la organización
        </p>
      </div>

      <OrgSettingsForm
        orgSlug={orgSlug}
        settings={{
          id: settings.id,
          cajaGeneralAccountCode: settings.cajaGeneralAccountCode,
          bancoAccountCode: settings.bancoAccountCode,
          cxcAccountCode: settings.cxcAccountCode,
          cxpAccountCode: settings.cxpAccountCode,
          roundingThreshold: Number(settings.roundingThreshold),
          cashParentCode: settings.cashParentCode,
          pettyCashParentCode: settings.pettyCashParentCode,
          bankParentCode: settings.bankParentCode,
          fleteExpenseAccountCode: settings.fleteExpenseAccountCode,
          polloFaenadoCOGSAccountCode: settings.polloFaenadoCOGSAccountCode,
        }}
      />
    </div>
  );
}
