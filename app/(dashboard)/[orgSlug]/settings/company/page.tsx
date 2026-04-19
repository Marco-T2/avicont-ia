import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { OrgProfileService } from "@/features/org-profile/server";
import { DocumentSignatureConfigService } from "@/features/document-signature-config/server";
import { CompanyProfileForm } from "@/components/settings/company/company-profile-form";

const orgProfileService = new OrgProfileService();
const documentSignatureConfigService = new DocumentSignatureConfigService();

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
      <div>
        <h1 className="text-3xl font-bold">Perfil de Empresa</h1>
        <p className="text-gray-500 mt-1">
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
