import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { OrgSettingsService } from "@/features/org-settings/server";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";

const settingsService = new OrgSettingsService();

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

  const settings = await settingsService.getOrCreate(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración General</h1>
        <p className="text-gray-500 mt-1">
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
