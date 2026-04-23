"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  DocumentPrintType,
  OrgProfile,
  SignatureLabel,
} from "@/generated/prisma/client";
import type { UpdateOrgProfileInput } from "@/features/org-profile/org-profile.types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IdentitySection, type IdentityValues } from "./identity-section";
import { LogoUploader } from "./logo-uploader";
import { DocTypeDropdown } from "./doc-type-dropdown";
import {
  SignatureConfigEditor,
  type SignatureConfigView,
} from "./signature-config-editor";

/**
 * CompanyProfileForm — composes IdentitySection + LogoUploader +
 * DocTypeDropdown + SignatureConfigEditor. Per-section Guardar pattern.
 *
 * REQ-OP.1, REQ-OP.3, REQ-OP.4, REQ-OP.10.
 *
 * Each section PATCHes its own endpoint:
 *   - Identity  → PATCH /api/organizations/[orgSlug]/profile
 *   - Logo      → POST  /api/organizations/[orgSlug]/profile/logo (by LogoUploader)
 *                 then PATCH /profile happens server-side via service.updateLogo
 *   - Signature → PATCH /api/organizations/[orgSlug]/signature-configs/[docType]
 */
interface CompanyProfileFormProps {
  orgSlug: string;
  profile: OrgProfile;
  views: SignatureConfigView[];
}

function profileToIdentity(profile: OrgProfile): IdentityValues {
  return {
    razonSocial: profile.razonSocial ?? "",
    nit: profile.nit ?? "",
    direccion: profile.direccion ?? "",
    ciudad: profile.ciudad ?? "",
    telefono: profile.telefono ?? "",
    representanteLegal: profile.representanteLegal ?? "",
    nroPatronal: profile.nroPatronal ?? "",
  };
}

export function CompanyProfileForm({
  orgSlug,
  profile,
  views,
}: CompanyProfileFormProps) {
  const router = useRouter();

  const [identity, setIdentity] = useState<IdentityValues>(
    profileToIdentity(profile),
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(profile.logoUrl);

  const [identitySaving, setIdentitySaving] = useState(false);
  const [identityErrors, setIdentityErrors] = useState<
    Partial<Record<keyof IdentityValues, string[]>>
  >({});

  const [configs, setConfigs] = useState<SignatureConfigView[]>(views);
  const [selectedDocType, setSelectedDocType] = useState<DocumentPrintType>(
    views[0]?.documentType ?? "COMPROBANTE",
  );
  const [configSaving, setConfigSaving] = useState(false);

  const selectedView =
    configs.find((v) => v.documentType === selectedDocType) ?? {
      documentType: selectedDocType,
      labels: [] as SignatureLabel[],
      showReceiverRow: false,
    };

  async function handleIdentitySave(patch: UpdateOrgProfileInput) {
    setIdentitySaving(true);
    setIdentityErrors({});
    try {
      const res = await fetch(`/api/organizations/${orgSlug}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (
          res.status === 400 &&
          data &&
          data.details &&
          typeof data.details === "object" &&
          "fieldErrors" in data.details
        ) {
          setIdentityErrors(
            data.details.fieldErrors as Partial<
              Record<keyof IdentityValues, string[]>
            >,
          );
        }
        toast.error(data?.error ?? "No se pudo guardar la identidad");
        return;
      }

      toast.success("Identidad guardada");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar la identidad");
    } finally {
      setIdentitySaving(false);
    }
  }

  function handleLogoChange(url: string) {
    setLogoUrl(url);
    toast.success("Logo actualizado");
    router.refresh();
  }

  function handleConfigChange(next: SignatureConfigView) {
    setConfigs((prev) =>
      prev.map((v) =>
        v.documentType === next.documentType ? next : v,
      ),
    );
  }

  async function handleConfigSave() {
    setConfigSaving(true);
    try {
      const res = await fetch(
        `/api/organizations/${orgSlug}/signature-configs/${selectedDocType}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labels: selectedView.labels,
            showReceiverRow: selectedView.showReceiverRow,
          }),
        },
      );
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.error ?? "No se pudo guardar la configuración");
        return;
      }

      toast.success("Configuración de firmas guardada");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar la configuración");
    } finally {
      setConfigSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Identidad</CardTitle>
          <CardDescription>
            Datos que se imprimen en todos los documentos PDF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IdentitySection
            values={identity}
            onChange={setIdentity}
            onSave={handleIdentitySave}
            saving={identitySaving}
            fieldErrors={identityErrors}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Imagen que se imprime en el encabezado de los documentos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUploader
            orgSlug={orgSlug}
            currentLogoUrl={logoUrl}
            onLogoChange={handleLogoChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firmas por tipo de documento</CardTitle>
          <CardDescription>
            Configurá los firmantes que aparecen al pie de cada PDF.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DocTypeDropdown
            value={selectedDocType}
            onChange={setSelectedDocType}
          />
          <SignatureConfigEditor
            docType={selectedDocType}
            view={selectedView}
            onChange={handleConfigChange}
            onSave={handleConfigSave}
            saving={configSaving}
          />
        </CardContent>
      </Card>
    </div>
  );
}
