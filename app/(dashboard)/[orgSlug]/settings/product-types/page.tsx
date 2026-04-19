import { redirect } from "next/navigation";
import { requirePermission } from "@/features/shared/permissions.server";
import { ProductTypesService } from "@/features/product-types/server";
import ProductTypesManager from "@/components/product-types/product-types-manager";

interface ProductTypesPageProps {
  params: Promise<{ orgSlug: string }>;
}

export default async function ProductTypesPage({ params }: ProductTypesPageProps) {
  const { orgSlug } = await params;

  let orgId: string;
  try {
    const result = await requirePermission("accounting-config", "write", orgSlug);
    orgId = result.orgId;
  } catch {
    redirect(`/${orgSlug}`);
  }

  const service = new ProductTypesService();
  // Fetch both active and inactive to show all in management view
  const [activeTypes, inactiveTypes] = await Promise.all([
    service.list(orgId, { isActive: true }),
    service.list(orgId, { isActive: false }),
  ]);
  const productTypes = [...activeTypes, ...inactiveTypes].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tipos de Producto</h1>
        <p className="text-gray-500 mt-1">
          Administra los tipos de producto utilizados en los despachos
        </p>
      </div>
      <ProductTypesManager
        orgSlug={orgSlug}
        initialProductTypes={JSON.parse(JSON.stringify(productTypes))}
      />
    </div>
  );
}
