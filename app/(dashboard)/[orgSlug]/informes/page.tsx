import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canAccess, requirePermission } from "@/features/permissions/server";
import { reportRegistry } from "@/features/reports";
import { CatalogPage } from "@/components/reports/catalog-page";

interface InformesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export const metadata: Metadata = {
  title: "Informes",
};

export default async function InformesPage({ params }: InformesPageProps) {
  const { orgSlug } = await params;

  let gate: Awaited<ReturnType<typeof requirePermission>> | undefined;
  try {
    gate = await requirePermission("reports", "read", orgSlug);
  } catch {
    redirect(`/${orgSlug}`);
  }
  // `redirect()` is typed `never` at runtime in Next.js; the guard here also
  // protects tests where `redirect` is a non-throwing `vi.fn()` mock.
  if (!gate) return null;
  const { role, orgId } = gate;

  // Per-entry RBAC filter (C0): resolve canAccess once per entry-with-resource.
  // Entries WITHOUT `resource` are always allowed (back-compat). Run in parallel
  // to avoid serializing matrix lookups for the catalog (matrix is cached at
  // the org level — cost is dominated by the first hit).
  const allowed = await Promise.all(
    reportRegistry.map((entry) =>
      entry.resource
        ? canAccess(role, entry.resource, "read", orgId)
        : Promise.resolve(true),
    ),
  );
  const entries = reportRegistry.filter((_, i) => allowed[i]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Informes</h1>
        <p className="text-muted-foreground mt-1">
          Catálogo de reportes contables y financieros
        </p>
      </div>

      <CatalogPage orgSlug={orgSlug} entries={entries} />
    </div>
  );
}
