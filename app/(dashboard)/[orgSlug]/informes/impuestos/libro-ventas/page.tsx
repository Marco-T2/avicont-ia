import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission } from "@/features/permissions/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { IvaBooksPageClient } from "@/components/iva-books/iva-books-page-client";

interface LibroVentasPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Libro de Ventas IVA",
};

export default async function LibroVentasPage({ params }: LibroVentasPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("reports", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const periodsService = makeFiscalPeriodsService();
  const periods = (await periodsService.list(orgId)).map((p) => p.toSnapshot());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro de Ventas IVA</h1>
        <p className="text-muted-foreground mt-1">
          Registro SIN Bolivia — 24 columnas
        </p>
      </div>

      <IvaBooksPageClient
        orgSlug={orgSlug}
        kind="sales"
        periods={JSON.parse(JSON.stringify(periods))}
      />
    </div>
  );
}
