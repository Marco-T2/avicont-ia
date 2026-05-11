import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/permissions/server";
import { makeOrgProfileService } from "@/modules/org-profile/presentation/server";
import { makeDocumentSignatureConfigService } from "@/modules/document-signature-config/presentation/server";
import { Button } from "@/components/ui/button";
import { CompanyProfileForm } from "@/components/settings/company/company-profile-form";

const orgProfileService = makeOrgProfileService();
const documentSignatureConfigService = makeDocumentSignatureConfigService();

interface CompanyProfilePageProps {
  params: Promise<{ orgSlug: string }>;
}

/**
 * RSC page for company profile (identity + logo + signatures).
 *
 * REQ-OP.6, REQ-OP.9. Guarded by `requirePermission("accounting-config", "write")`.
 * Hydrates the OrgProfile row (lazy getOrCreate) and the 8 signature-config
 * views, then hands both to the client form.
 */
export default async function CompanyProfilePage({
  params,
}: CompanyProfilePageProps) {
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

  const [profile, views] = await Promise.all([
    orgProfileService.getOrCreate(orgId),
    documentSignatureConfigService.listAll(orgId),
  ]);

  return (
    <div className="space-y-6">
      <Link href={`/${orgSlug}/settings`}>
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a Configuración
        </Button>
      </Link>

      <div>
        <h1 className="text-3xl font-bold">Perfil de Empresa</h1>
        <p className="text-muted-foreground mt-1">
          Identidad, logo y configuración de firmas por tipo de documento
        </p>
      </div>

      <CompanyProfileForm
        orgSlug={orgSlug}
        profile={profile}
        views={views}
      />
    </div>
  );
}
