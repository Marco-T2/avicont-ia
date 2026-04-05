import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess, requireRole } from "@/features/shared/middleware";
import { OrgSettingsService } from "@/features/org-settings";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";

const settingsService = new OrgSettingsService();

interface SettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { orgSlug } = await params;

  let userId: string;
  let orgId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
    orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin"]);
  } catch {
    redirect("/sign-in");
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
        }}
      />
    </div>
  );
}
