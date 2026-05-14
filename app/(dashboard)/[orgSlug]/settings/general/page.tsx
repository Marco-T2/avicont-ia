import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
import { makeAccountsService } from "@/modules/accounting/presentation/server";
import { Button } from "@/components/ui/button";
import { OrgSettingsForm } from "@/components/settings/org-settings-form";
import type { AccountOption } from "@/components/settings/org-settings-form";

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

  const accountsService = makeAccountsService();

  const [settingsEntity, detailAccountsRaw, parentAccountsRaw] =
    await Promise.all([
      settingsService.getOrCreate(orgId),
      accountsService.list(orgId, { isDetail: true, isActive: true }),
      accountsService.list(orgId, { isDetail: false, isActive: true }),
    ]);

  const settings = settingsEntity.toSnapshot();

  // Mapeo a subset AccountOption — el modelo Prisma `Account` crudo NUNCA cruza
  // al cliente. JSON.parse(JSON.stringify()) garantiza un payload serializable,
  // mismo patrón que /sales/new y /purchases/new.
  const toOption = (a: { code: string; name: string; isDetail: boolean }): AccountOption => ({
    code: a.code,
    name: a.name,
    isDetail: a.isDetail,
  });
  const detailAccounts: AccountOption[] = JSON.parse(
    JSON.stringify(detailAccountsRaw.map(toOption)),
  );
  const parentAccounts: AccountOption[] = JSON.parse(
    JSON.stringify(parentAccountsRaw.map(toOption)),
  );

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
        detailAccounts={detailAccounts}
        parentAccounts={parentAccounts}
      />
    </div>
  );
}
