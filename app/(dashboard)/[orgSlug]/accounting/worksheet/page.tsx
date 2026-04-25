import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { WorksheetPageClient } from "@/components/accounting/worksheet-page-client";

interface WorksheetPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function WorksheetPage({ params }: WorksheetPageProps) {
  const { orgSlug } = await params;

  try {
    await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Hoja de Trabajo</h1>
        <p className="text-muted-foreground mt-1">
          Hoja de Trabajo 12 Columnas — Herramienta auxiliar de ajustes contables
        </p>
      </div>

      <WorksheetPageClient orgSlug={orgSlug} />
    </div>
  );
}
