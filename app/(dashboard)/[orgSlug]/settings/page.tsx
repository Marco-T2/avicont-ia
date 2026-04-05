import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";

interface SettingsPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { orgSlug } = await params;

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  try {
    await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configuración General</h1>
        <p className="text-gray-500 mt-1">
          Configuración de cuentas contables y parámetros de la organización
        </p>
      </div>

      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        <p>Módulo de configuración en construcción.</p>
        <p className="text-sm mt-2">
          Las API routes están disponibles en{" "}
          <code className="bg-muted px-1 rounded">/api/organizations/{orgSlug}/settings</code>
        </p>
      </div>
    </div>
  );
}
