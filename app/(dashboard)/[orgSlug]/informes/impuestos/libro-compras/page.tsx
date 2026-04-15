import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
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

  let userId: string;
  try {
    const session = await requireAuth();
    userId = session.userId;
  } catch {
    redirect("/sign-in");
  }

  let orgId: string;
  try {
    orgId = await requireOrgAccess(userId, orgSlug);
  } catch {
    redirect("/select-org");
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
