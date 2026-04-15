import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth, requireOrgAccess } from "@/features/shared";
import { CatalogPage } from "@/components/reports/catalog-page";

interface InformesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Informes",
};

export default async function InformesPage({ params }: InformesPageProps) {
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
        <h1 className="text-3xl font-bold">Informes</h1>
        <p className="text-gray-500 mt-1">
          Catálogo de reportes contables y financieros
        </p>
      </div>

      <CatalogPage orgSlug={orgSlug} />
    </div>
  );
}
