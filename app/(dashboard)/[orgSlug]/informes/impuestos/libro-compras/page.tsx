import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import { IvaBooksPageClient } from "@/components/iva-books/iva-books-page-client";

interface LibroComprasPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Libro de Compras IVA",
};

export default async function LibroComprasPage({ params }: LibroComprasPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("reports", "read", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const periodsService = new FiscalPeriodsService();
  const periods = await periodsService.list(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Libro de Compras IVA</h1>
        <p className="text-gray-500 mt-1">
          Registro SIN Bolivia — 23 columnas
        </p>
      </div>

      <IvaBooksPageClient
        orgSlug={orgSlug}
        kind="purchases"
        periods={JSON.parse(JSON.stringify(periods))}
      />
    </div>
  );
}
